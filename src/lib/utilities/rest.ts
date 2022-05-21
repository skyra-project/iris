import { envParseString } from '@skyra/env-utilities';
import { container } from '@skyra/http-framework';
import {
	Routes,
	type RESTDeleteAPIChannelAllMessageReactionsResult,
	type RESTGetAPIApplicationCommandPermissionsResult,
	type RESTGetAPIApplicationCommandsResult,
	type RESTGetAPIApplicationGuildCommandsResult,
	type RESTGetAPIChannelMessageResult,
	type RESTGetAPIGuildRolesResult,
	type RESTPatchAPIChannelJSONBody,
	type RESTPatchAPIChannelMessageJSONBody,
	type RESTPatchAPIChannelResult,
	type RESTPostAPIChannelMessageJSONBody,
	type RESTPostAPIChannelMessageResult,
	type RESTPostAPIChannelThreadsJSONBody,
	type RESTPostAPIChannelThreadsResult,
	type RESTPutAPIChannelMessageReactionResult,
	type RESTPutAPIChannelThreadMembersResult
} from 'discord-api-types/v10';

export type Snowflake = string | bigint;

export namespace ApplicationId {
	const applicationId = envParseString('DISCORD_CLIENT_ID');

	export namespace Commands {
		export function get(): Promise<get.Result> {
			const route = Routes.applicationCommands(applicationId);
			return container.rest.get(route) as Promise<get.Result>;
		}

		export namespace get {
			export type Result = RESTGetAPIApplicationCommandsResult;
		}
	}

	export namespace GuildId {
		export namespace Commands {
			export function get(guildId: Snowflake): Promise<get.Result> {
				const route = Routes.applicationGuildCommands(applicationId, guildId.toString());
				return container.rest.get(route) as Promise<get.Result>;
			}

			export namespace get {
				export type Result = RESTGetAPIApplicationGuildCommandsResult;
			}
		}

		export namespace CommandId.Permissions {
			export function get(guildId: Snowflake, commandId: Snowflake): Promise<get.Result> {
				const route = Routes.applicationCommandPermissions(applicationId, guildId.toString(), commandId.toString());
				return container.rest.get(route) as Promise<get.Result>;
			}

			export namespace get {
				export type Result = RESTGetAPIApplicationCommandPermissionsResult;
			}
		}
	}
}

export namespace ChannelId {
	export function patch(channelId: Snowflake, body: patch.Body) {
		const route = Routes.channel(channelId.toString());
		return container.rest.patch(route, { body }) as Promise<patch.Result>;
	}

	export namespace patch {
		export type Body = RESTPatchAPIChannelJSONBody;
		export type Result = RESTPatchAPIChannelResult;
	}

	export namespace Messages {
		export function post(channelId: Snowflake, body: post.Body) {
			const route = Routes.channelMessages(channelId.toString());
			return container.rest.post(route, { body }) as Promise<post.Result>;
		}

		export namespace post {
			export type Body = RESTPostAPIChannelMessageJSONBody;
			export type Result = RESTPostAPIChannelMessageResult;
		}
	}

	export namespace MessageId {
		export function get(channelId: Snowflake, messageId: Snowflake) {
			const route = Routes.channelMessage(channelId.toString(), messageId.toString());
			return container.rest.get(route) as Promise<get.Result>;
		}

		export namespace get {
			export type Result = RESTGetAPIChannelMessageResult;
		}

		export function patch(channelId: Snowflake, messageId: Snowflake, body: patch.Body) {
			const route = Routes.channelMessage(channelId.toString(), messageId.toString());
			return container.rest.patch(route, { body }) as Promise<patch.Result>;
		}

		export namespace patch {
			export type Body = RESTPatchAPIChannelMessageJSONBody;
			export type Result = RESTGetAPIChannelMessageResult;
		}

		export namespace Reactions {
			export function remove(channelId: Snowflake, messageId: Snowflake) {
				const route = Routes.channelMessageAllReactions(channelId.toString(), messageId.toString());
				return container.rest.delete(route) as Promise<remove.Result>;
			}

			export namespace remove {
				export type Result = RESTDeleteAPIChannelAllMessageReactionsResult;
			}
		}

		export namespace ReactionId {
			export function put(channelId: Snowflake, messageId: Snowflake, emoji: string) {
				const route = Routes.channelMessageOwnReaction(channelId.toString(), messageId.toString(), emoji);
				return container.rest.put(route) as Promise<put.Result>;
			}

			export namespace put {
				export type Result = RESTPutAPIChannelMessageReactionResult;
			}
		}

		export namespace Threads {
			export function post(channelId: Snowflake, messageId: Snowflake, body: post.Body) {
				const route = Routes.threads(channelId.toString(), messageId.toString());
				return container.rest.post(route, { body }) as Promise<post.Result>;
			}

			export namespace post {
				export type Body = RESTPostAPIChannelThreadsJSONBody;
				export type Result = RESTPostAPIChannelThreadsResult;
			}
		}
	}

	export namespace ThreadMemberId {
		export function put(channelId: Snowflake, userId: Snowflake) {
			const route = Routes.threadMembers(channelId.toString(), userId.toString());
			return container.rest.post(route) as Promise<put.Result>;
		}

		export namespace put {
			export type Result = RESTPutAPIChannelThreadMembersResult;
		}
	}
}

export namespace GuildId {
	export namespace Roles {
		export function get(guildId: Snowflake) {
			const route = Routes.guildRoles(guildId.toString());
			return container.rest.get(route) as Promise<get.Result>;
		}

		export namespace get {
			export type Result = RESTGetAPIGuildRolesResult;
		}
	}
}
