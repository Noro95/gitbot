import { Response } from "express";
import { Octokit } from "@octokit/rest";
import {
	InteractionResponseType,
	MessageFlags,
	ComponentType,
	ButtonStyle,
} from "discord-api-types/v10";
import {
	// IntEmitter,
	DiscordRestClient,
	// ClearComponents,
	OctoErrMsg,
	CreateIssueEmbed,
	DiscordTimestamp,
} from "@utils";
// import Update from "./update.js";

export default async function Create(
	res: Response,
	rest: DiscordRestClient,
	octo: Octokit,
	options: Map<string, any>
) {
	// saved date and customId constants
	const date = Date.now().toString();
	const updateModalBtn = `umbtn-${date}`;

	/** owner of the repo
	 * ! REQUIRED
	 */
	const owner = options.get("owner");
	/** name of the repo
	 * ! REQUIRED
	 */
	const repo = options.get("repo");
	/** title of the issue
	 * ! REQUIRED
	 */
	const title = options.get("title");
	/** content/body of the issue */
	const body = options.get("body");
	/** assignees */
	const assignees = options.get("assignees");
	/** milestone */
	const milestone = options.get("milestone");
	/** labels */
	const labels = options.get("labels");

	// create req
	const req = await octo.issues
		.create({
			owner,
			repo,
			title,
			body,
			assignees: assignees?.split(",").map((a: string) => a.trim()),
			milestone,
			labels: labels?.split(",").map((l: string) => l.trim()),
		})
		// catch error
		.catch((e) => {
			res.json({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: OctoErrMsg(e),
					flags: MessageFlags.Ephemeral,
				},
			});
			return;
		});

	// if error
	if (!req) return;

	// var for easier access
	const data = req.data;

	// for buttons
	options.set("issue_number", data.number);

	// create the embed
	const embed = CreateIssueEmbed(data);

	//! The update (MODAL) button stuff
	// // handle button clicks
	// // modal update click
	// IntEmitter.on(updateModalBtn, async (...args) => {
	// 	// call the update pr modal
	// 	await Update(args[0], octo, options);
	// 	// clear the components
	// 	await ClearComponents(rest, res.req.body);
	// 	// if the modal is closed, and everything successful, remove the listener
	// 	IntEmitter.removeAllListeners(updateModalBtn);
	// 	return;
	// });

	// button components to be added
	const components = [
		{
			type: ComponentType.ActionRow,
			components: [
				{
					type: ComponentType.Button,
					// style: ButtonStyle.Primary,
					style: ButtonStyle.Link,
					// label: "Update",
					label: "Edit",
					// custom_id: updateModalBtn,
					url: `https://github.com/${owner}/${repo}/issues/${data.number}`,
				},
			],
		},
	];

	// return the response
	return res.json({
		type: InteractionResponseType.ChannelMessageWithSource,
		data: {
			content: `[\`${data.user?.login}\`](${
				data.user?.html_url
			}) opened this issue ${DiscordTimestamp(data.created_at, "R")} | ${
				data.comments
			} comments`,
			embeds: [embed],
			components: components,
			flags: MessageFlags.Ephemeral,
		},
	});
}
