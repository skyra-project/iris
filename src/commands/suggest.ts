import { EmptyMentions, SuggestionStatusColors } from '#lib/common/constants';
import { LanguageKeys } from '#lib/i18n/LanguageKeys';
import { apply } from '#lib/utilities/add-builder-localizations';
import { Id, makeCustomId, makeIntegerString, Status } from '#lib/utilities/id-creator';
import { getUser } from '#lib/utilities/interactions';
import { ChannelId } from '#lib/utilities/rest';
import { addCount, useCount, useEmbedContent, usePlainContent, useReactions, useThread } from '#lib/utilities/suggestion-utilities';
import { displayAvatarURL } from '#lib/utilities/user';
import { channelMention, EmbedBuilder, time, userMention } from '@discordjs/builders';
import { Collection } from '@discordjs/collection';
import type { Guild } from '@prisma/client';
import { AsyncQueue } from '@sapphire/async-queue';
import { fromAsync } from '@sapphire/result';
import { Command, RegisterCommand } from '@skyra/http-framework';
import { getSupportedLanguageT, getSupportedUserLanguageT, resolveKey, resolveUserKey } from '@skyra/http-framework-i18n';
import { ButtonStyle, ComponentType, MessageFlags, type APIMessage } from 'discord-api-types/v10';

type MessageData = LanguageKeys.Commands.Suggest.MessageData;

@RegisterCommand((builder) =>
	apply(builder, LanguageKeys.Commands.Suggest.RootName, LanguageKeys.Commands.Suggest.RootDescription) //
		.addStringOption((option) => apply(option, LanguageKeys.Commands.Suggest.OptionsSuggestion).setRequired(true))
		.addIntegerOption((option) => apply(option, LanguageKeys.Commands.Suggest.OptionsId))
		.setDMPermission(false)
)
export class UserCommand extends Command {
	private readonly queues = new Collection<bigint, AsyncQueue>();
	public override chatInputRun(interaction: Command.Interaction, options: Options): Command.GeneratorResponse {
		return options.id === undefined
			? this.handleNew(interaction, options.suggestion)
			: this.handleEdit(interaction, options.id, options.suggestion);
	}

	private async *handleNew(interaction: Command.Interaction, rawInput: string): Command.GeneratorResponse {
		const guildId = BigInt(interaction.guild_id!);
		const settings = await this.container.prisma.guild.findUnique({
			where: { id: guildId }
		});
		if (!settings?.channel) {
			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.NewNotConfigured);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		yield this.defer({ flags: MessageFlags.Ephemeral });

		const queue = this.queues.ensure(guildId, () => new AsyncQueue());
		await queue.wait();

		let id: number;
		let message: APIMessage;
		try {
			const count = await useCount(guildId);
			id = count + 1;

			const input = settings.embed ? await useEmbedContent(rawInput, guildId, settings.channel, count) : usePlainContent(rawInput);
			const user = this.makeUserData(interaction);
			const body = this.makeMessage(interaction, settings, { id, message: input, timestamp: time(), user });

			const postResult = await fromAsync(ChannelId.Messages.post(settings.channel, body));
			if (!postResult.success) {
				const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.NewFailedToSend, {
					channel: channelMention(settings.channel.toString())
				});
				return this.updateMessage({ content, flags: MessageFlags.Ephemeral });
			}

			message = postResult.value;
			await this.container.prisma.suggestion.create({
				data: { id, guildId, authorId: BigInt(user.id), messageId: BigInt(message.id) },
				select: null
			});

			addCount(guildId);
		} finally {
			queue.shift();
		}

		const t = getSupportedUserLanguageT(interaction);
		const errors: string[] = [];

		if (settings.reactions.length) {
			const result = await useReactions(t, settings, message);
			if (!result.success) errors.push(result.error);
		}

		if (settings.autoThread) {
			const result = await useThread(interaction, id, { message, input: rawInput });

			if (!result.success) errors.push(t(result.error));
			else if (!result.value.memberAddResult.success) errors.push(t(result.value.memberAddResult.error));
		}

		const header = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.NewSuccess, { id });
		const details = errors.length === 0 ? '' : `\n\n- ${errors.join('\n- ')}`;

		const content = header + details;
		return this.updateMessage({ content, flags: MessageFlags.Ephemeral });
	}

	private makeUserData(interaction: Command.Interaction): MessageData['user'] {
		const user = getUser(interaction);

		return {
			id: user.id,
			username: user.username,
			discriminator: user.discriminator,
			mention: userMention(user.id)
		};
	}

	private makeMessage(interaction: Command.Interaction, settings: Guild, data: MessageData): ChannelId.Messages.post.Body {
		const resolved = settings.embed ? this.makeEmbedMessage(interaction, data) : this.makeContentMessage(interaction, data);
		return { ...resolved, components: this.makeComponents(interaction, settings, data), allowed_mentions: EmptyMentions };
	}

	private makeComponents(interaction: Command.Interaction, settings: Guild, data: MessageData) {
		type MessageComponent = NonNullable<Command.MessageResponseOptions['components']>[number];

		const components: MessageComponent[] = [];
		if (!settings.buttons) return components;

		const id = makeIntegerString(data.id);
		const t = getSupportedLanguageT(interaction);
		const manageRow: MessageComponent = {
			type: ComponentType.ActionRow,
			components: [
				{
					type: ComponentType.Button,
					custom_id: makeCustomId(Id.Suggestions, 'archive', id),
					style: ButtonStyle.Danger,
					label: t(LanguageKeys.Commands.Suggest.ComponentsArchive)
				}
			]
		};
		if (!settings.autoThread) {
			manageRow.components.unshift({
				type: ComponentType.Button,
				custom_id: makeCustomId(Id.Suggestions, 'thread', id),
				style: ButtonStyle.Primary,
				label: t(LanguageKeys.Commands.Suggest.ComponentsCreateThread)
			});
		}

		components.push(manageRow);

		if (settings.compact) {
			manageRow.components.push(
				{
					type: ComponentType.Button,
					custom_id: makeCustomId(Id.Suggestions, 'resolve', id, Status.Accept),
					style: ButtonStyle.Success,
					label: t(LanguageKeys.Commands.Suggest.ComponentsAccept)
				},
				{
					type: ComponentType.Button,
					custom_id: makeCustomId(Id.Suggestions, 'resolve', id, Status.Consider),
					style: ButtonStyle.Secondary,
					label: t(LanguageKeys.Commands.Suggest.ComponentsConsider)
				},
				{
					type: ComponentType.Button,
					custom_id: makeCustomId(Id.Suggestions, 'resolve', id, Status.Deny),
					style: ButtonStyle.Danger,
					label: t(LanguageKeys.Commands.Suggest.ComponentsDeny)
				}
			);
		} else {
			components.push({
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.SelectMenu,
						custom_id: makeCustomId(Id.Suggestions, 'resolve', id),
						options: [
							{ label: t(LanguageKeys.Commands.Suggest.ComponentsAccept), value: Status.Accept },
							{ label: t(LanguageKeys.Commands.Suggest.ComponentsConsider), value: Status.Consider },
							{ label: t(LanguageKeys.Commands.Suggest.ComponentsDeny), value: Status.Deny }
						]
					}
				]
			});
		}

		return components;
	}

	private makeEmbedMessage(interaction: Command.Interaction, data: MessageData): ChannelId.Messages.post.Body {
		const name = resolveKey(interaction, LanguageKeys.Commands.Suggest.NewMessageEmbedTitle, data);
		const embed = new EmbedBuilder()
			.setColor(SuggestionStatusColors.Unresolved)
			.setAuthor({ name, iconURL: displayAvatarURL(interaction.member!.user) })
			.setDescription(data.message);
		return { embeds: [embed.toJSON()] };
	}

	private makeContentMessage(interaction: Command.Interaction, data: MessageData): ChannelId.Messages.post.Body {
		const content = resolveKey(interaction, LanguageKeys.Commands.Suggest.NewMessageContent, data);
		return { content };
	}

	private async *handleEdit(interaction: Command.Interaction, id: number, rawInput: string): Command.GeneratorResponse {
		yield this.defer({ flags: MessageFlags.Ephemeral });

		const guildId = BigInt(interaction.guild_id!);
		const suggestion = await this.container.prisma.suggestion.findUnique({
			where: { id_guildId: { id, guildId } }
		});

		// If the suggestion does not exist, return early:
		if (suggestion === null) {
			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.ModifyDoesNotExist);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		// If the suggestion was made by a different author, return early:
		const userId = BigInt(getUser(interaction).id);
		if (suggestion.authorId !== userId) {
			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.ModifyMismatchingAuthor);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		// If the suggestion was archived, return early:
		if (suggestion.archivedAt !== null) {
			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.ModifyArchived);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		// If the suggestion was already replied to, its contents become immutable to avoid changing the contents after
		// a decision. As such, return early:
		if (suggestion.repliedAt !== null) {
			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.ModifyReplied);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		// Get the guild settings to get the channel:
		const settings = await this.container.prisma.guild.findUnique({
			where: { id: guildId },
			select: { channel: true }
		});

		// If the settings were deleted or the channel not configured, everything becomes readonly. As such, return early:
		if (!settings?.channel) {
			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.NewNotConfigured);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		const result = await fromAsync(ChannelId.MessageId.get(settings.channel, suggestion.messageId));
		if (!result.success) {
			await this.container.prisma.suggestion.update({
				where: { id_guildId: suggestion },
				data: { archivedAt: new Date() }
			});

			const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.ModifyMessageDeleted);
			return this.message({ content, flags: MessageFlags.Ephemeral });
		}

		const message = result.value;
		let data: ChannelId.MessageId.patch.Body;
		if (message.embeds.length) {
			const description = await useEmbedContent(rawInput, guildId, settings.channel);
			data = { embeds: [{ ...message.embeds[0], description }] };
		} else {
			const content = message.content.slice(0, message.content.indexOf('\n')) + usePlainContent(rawInput);
			data = { content, allowed_mentions: EmptyMentions };
		}
		await ChannelId.MessageId.patch(message.channel_id, message.id, data);

		const content = resolveUserKey(interaction, LanguageKeys.Commands.Suggest.ModifySuccess, { id });
		return this.updateMessage({ content, flags: MessageFlags.Ephemeral });
	}

	private updateMessage(data: Command.MessageResponseOptions) {
		return data;
	}
}

interface Options {
	suggestion: string;
	id?: number;
}
