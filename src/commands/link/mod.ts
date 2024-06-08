import {
	APIInteractionResponseCallbackData,
	ApplicationCommandType,
	ButtonStyle,
	ComponentType,
	InteractionResponseType,
	MessageFlags,
} from "discord-api-types/v10";
import { CommandData, EnvVar } from "../../utils";
import { ghLinks } from "../../utils";
import { FindUser } from "../../database/functions/user";
import { UserEnums } from "../../interfaces/database/user";
import { randomBytes, hash } from "crypto";

export default {
	name: "link",
	description: "Link your Github account with Discord",
	type: ApplicationCommandType.ChatInput,
	contexts: [0, 1, 2],
	integration_types: [0, 1],
	run: async (res, interaction) => {
		const userId = interaction.member?.user.id || interaction.user?.id;
		if (await FindUser({ discordId: userId }))
			return res.json({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: UserEnums.DiscordLinked,
					flags: MessageFlags.Ephemeral,
				},
			});

		// generate a random hash
		const random = hash("sha256", randomBytes(18).toString());
		// add user id to the ghlinks list with the random string
		ghLinks.set(random, userId!);

		// remove user from ghlinks after 10 mins
		setTimeout(() => {
			ghLinks.has(random) ? ghLinks.delete(random) : null;
		}, 10 * 60 * 1000);

		const env = EnvVar();
		// send sign up link
		res.json({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content:
					"Link your Github account to use the other commands! Expires after 10 Minutes",
				flags: MessageFlags.Ephemeral,
				components: [
					{
						type: ComponentType.ActionRow,
						components: [
							{
								type: ComponentType.Button,
								style: ButtonStyle.Link,
								label: "Sign in",
								url: `${env.SITE_URL}/github/verify/${random}`,
							},
						],
					},
				],
			} as APIInteractionResponseCallbackData,
		});
		return;
	},
} as CommandData;
