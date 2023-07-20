const fs = require("fs");
const path = require("path");
const ytdl = require("ytdl-core");
const axios = require("axios");
const SpotifyWebApi = require("spotify-web-api-node");

const SPOTIPY_CLIENT_ID = "CLIENT ID";
const SPOTIPY_CLIENT_SECRET = "CLIENT SECRET";

const clientCredentialsManager = new SpotifyWebApi({
    clientId: SPOTIPY_CLIENT_ID,
    clientSecret: SPOTIPY_CLIENT_SECRET,
});

async function main() {
    try {
        const playlistUrl = await prompt("Enter the Spotify playlist URL: ");
        const tracks = await getPlaylistTracks(playlistUrl);

        if (tracks.length === 0) {
            console.log("No tracks found in the playlist.");
            return;
        }

        const downloadPath = path.join(__dirname, "downloads");
        fs.mkdirSync(downloadPath, { recursive: true });

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            console.log(`Downloading '${track.name}' by '${track.artists.join(", ")}'...`);
            await downloadTrack(track.name, track.artists, downloadPath);
        }

        console.log("All tracks downloaded successfully.");
    } catch (error) {
        console.error("Error:", error.message);
    }
}

async function getPlaylistTracks(playlistUrl) {
    try {
        const playlistId = playlistUrl.split("/").pop();
        const playlist = await clientCredentialsManager.getPlaylist(playlistId);

        return playlist.body.tracks.items.map((item) => {
            const track = item.track;
            return {
                name: track.name,
                artists: track.artists.map((artist) => artist.name),
            };
        });
    } catch (error) {
        throw new Error("Invalid Spotify playlist URL or unable to retrieve tracks.");
    }
}

async function downloadTrack(trackName, artists, downloadPath) {
    const searchTerm = `${trackName} ${artists.join(" ")}`;
    const videoUrl = await findYouTubeVideo(searchTerm);

    if (!videoUrl) {
        throw new Error(`No video found on YouTube for '${searchTerm}'.`);
    }

    const videoInfo = await ytdl.getInfo(videoUrl);
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, { filter: "audioonly" });

    const filePath = path.join(downloadPath, `${trackName}.mp3`);
    const fileStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        ytdl(videoUrl, { format: audioFormat }).pipe(fileStream);

        fileStream.on("finish", () => {
            console.log(`Downloaded '${trackName}'.`);
            resolve();
        });

        fileStream.on("error", (error) => {
            reject(new Error(`Failed to download '${trackName}': ${error.message}`));
        });
    });
}

async function findYouTubeVideo(query) {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        query
    )}&type=video&key=${process.env.YOUTUBE_API_KEY}`;

    try {
        const response = await axios.get(searchUrl);
        const videoId = response.data.items[0]?.id?.videoId;

        if (!videoId) {
            throw new Error("No video found on YouTube.");
        }

        return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (error) {
        throw new Error("Failed to find video on YouTube.");
    }
}

async function prompt(question) {
    const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        readline.question(question, (answer) => {
            readline.close();
            resolve(answer);
        });
    });
}

if (require.main === module) {
    main();
}
