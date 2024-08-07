import { json, Router } from "express";
import { encryptToken, env, DiscordRestClient, Errors, ghLinks, DateInISO } from "@utils";
import { InitUser } from "@database/functions/user.js";
import { APIUser, Routes } from "discord-api-types/v10";
import { Octokit } from "@octokit/rest";
import axios from "axios";

// setting up a router
const github = Router();

// setting up a rest client for the verifications
const rest = new DiscordRestClient(env.DISCORD_APP_TOKEN!);

// first route users gets sent to for redirection
github.get("/verify/:random", (req, res) => {
	const random = req.params.random;
	if (!random || !ghLinks.has(random)) return res.sendStatus(400);
	res.redirect(
		`https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&state=${random}`
	);
});

// auth & getting access token here
github.get("/callback", async (req, res) => {
	const state = req.query.state as string;
	// check if the state is valid
	if (!state || !ghLinks.has(state)) return res.sendStatus(400);
	const discordID = ghLinks.get(state);

	// remove state (userId) from the list
	ghLinks.delete(state);

	// get the code
	const code = req.query.code as string;

	// get the access token
	const result = await (
		await axios({
			url: `https://github.com/login/oauth/access_token?client_id=${env.GITHUB_CLIENT_ID}&client_secret=${env.GITHUB_CLIENT_SECRET}&code=${code}`,
			headers: {
				Accept: "application/vnd.github+json",
			},
			method: "POST",
		}).catch(() => {
			res.send(Errors.Unexpected);
			return;
		})
	)?.data;

	if (!result) return;
	// check if the access token is valid
	if (!result.access_token) return res.sendStatus(400);

	// initialize octokit
	const octokit = new Octokit({
		auth: result.access_token,
	});

	// get the discord user data
	const discord_user = (await rest.req(
		"GET",
		Routes.user(discordID)
	)) as APIUser;
	// get the github user data
	const github_user = (await octokit.users.getAuthenticated()).data;

	// check if the returned user data is valid & if the access token is valid
	if (!discord_user || !github_user || !discord_user.id || !github_user.id)
		return res.sendStatus(400);

	// initialize the user
	const InitUserResult = await InitUser({
		discord: {
			id: discord_user.id,
		},
		github: {
			id: github_user.id.toString(),
			login: github_user.login,
			name: github_user.name,
			location: github_user.location,
			bio: github_user.bio,
			twitter: github_user.twitter_username,
			followers: github_user.followers,
			following: github_user.following,
			created_at: github_user.created_at,
			access_token: encryptToken(result.access_token),
		},
	});
	// return initializing result
	return res.send(InitUserResult);
});

// the webhooks route
//TODO: use the webhook to manage uh stuff?
github.post("/webhook", json(), (req, res) => {
	console.log(
		DateInISO(),
		"[WEBHOOK]",
		req.body.issue
			? "issue"
			: req.body.pull_request
			? "pull_request"
			: "unknown",
		req.body.action
	);
	res.sendStatus(200);
});

export default github;
