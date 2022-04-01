const Util = require("soundcloud-scraper/src/util/Util");
const Song = require("soundcloud-scraper/src/structures/Song");

class Client {

    constructor(API_KEY = null, ClientOptions = { fetchAPIKey: true }) {

        Object.defineProperty(this, "API_KEY", {
            value: null,
            writable: true
        });

        this.options = ClientOptions;

        this.createAPIKey(API_KEY, !!this.options.fetchAPIKey);
    }

    getSongInfo(url, options = { fetchEmbed: false, fetchComments: false, fetchStreamURL: false, requestOptions: {} }) {
        return new Promise(async (resolve, reject) => {
            try {
                if (typeof url !== "string") return reject(new TypeError(`URL type must be a string, received "${typeof url}"!`));
                if (!Util.validateURL(url, "track")) return reject(new TypeError("Invalid song url!"));
                const raw = await Util.parseHTML(url, options.requestOptions || {});
                if (!raw) return reject(new Error("Couldn't parse html!"));
                const $ = Util.loadHTML(raw);

                const duration = raw.split('<meta itemprop="duration" content="') && raw.split('<meta itemprop="duration" content="')[1] && raw.split('<meta itemprop="duration" content="')[1].split('" />')[0];
                const name = raw.split("<h1 itemprop=\"name\">") && raw.split("<h1 itemprop=\"name\">")[1].split("by <a")[1] && raw.split("<h1 itemprop=\"name\">")[1].split("by <a")[1].split(">")[1] && raw.split("<h1 itemprop=\"name\">")[1].split("by <a")[1].split(">")[1].split("</a>")[0].replace("</a", "")
                const trackURLBase = raw.split('},{"url":"')[1];
                let trackURL = null;
                if (trackURLBase) trackURL = trackURLBase.split('","')[0];
                const commentSection = raw.split("<section class=\"comments\">") && raw.split("<section class=\"comments\">")[1] ? raw.split("<section class=\"comments\">")[1].split("</section>")[0] : null

                const obj = {
                    id: $("meta[property=\"al:ios:url\"]").attr("content").split(":").pop(),
                    title: $("meta[property=\"og:title\"]").attr("content"),
                    description: $("meta[property=\"og:description\"]").attr("content"),
                    thumbnail: $("meta[property=\"og:image\"]").attr("content"),
                    url: $("link[rel=\"canonical\"]").attr("href"),
                    duration: duration ? Util.parseDuration(duration) : 0,
                    playCount: $("meta[property=\"soundcloud:play_count\"]").attr("content"),
                    commentsCount: $("meta[property=\"soundcloud:comments_count\"]").attr("content"),
                    likes: $("meta[property=\"soundcloud:like_count\"]").attr("content"),
                    genre: raw.split(",\"genre\":\"")[1] && raw.split(",\"genre\":\"")[1].split("\",\"")[0].replace(/\\u0026/g, "&"),
                    author: {
                        name: name || null,
                        username: $("meta[property=\"soundcloud:user\"]").attr("content").replace("https://soundcloud.com/", ""),
                        url: $("meta[property=\"soundcloud:user\"]").attr("content"),
                        avatarURL: raw.split('"avatar_url":"') && raw.split('"avatar_url":"')[raw.split('"avatar_url":"').length - 1].split('"')[0] || null,
                        urn: parseInt(Constants.USER_URN_PATTERN.exec(raw).groups.urn) || null,
                        verified: !raw.includes("\",\"verified\":false,\"visuals\""),
                        followers: parseInt(raw.split(",\"followers_count\":") && raw.split(",\"followers_count\":")[1].split(",")[0]) || 0,
                        following: parseInt(raw.split(",\"followings_count\":") && raw.split(",\"followings_count\":")[1].split(",")[0]) || 0,
                    },
                    publishedAt: new Date(raw.split("<time pubdate>")[1] && raw.split("<time pubdate>")[1].split("</time>")[0]) || null,
                    embedURL: $("link[type=\"text/json+oembed\"]").attr("href"),
                    embed: !!options.fetchEmbed ? await this.getEmbed($("link[type=\"text/json+oembed\"]").attr("href")) : null,
                    track: {
                        hls: trackURL ? trackURL.replace("/progressive", "/hls") : null,
                        progressive: trackURL || null
                    },
                    trackURL: trackURL || null,
                    comments: !!options.fetchComments && !!commentSection ? Util.parseComments(commentSection) : []
                };

                if (!!options.fetchStreamURL) {
                    const url = await this.fetchStreamURL(obj.trackURL);
                    obj.streamURL = url || "";
                } else obj.streamURL = "";

                return resolve(new Song(obj));
            } catch (e) {
                return reject(e);
            }
        });
    }

    getPlaylist(url, options = { fetchEmbed: false }) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!url || typeof url !== "string") return reject(new Error(`URL must be a string, received "${typeof url}"!`));
                if (!Util.validateURL(url, "playlist")) return reject(new TypeError("Invalid url!"));

                const raw = await Util.parseHTML(url);
                if (!raw) return reject(new Error("Couldn't parse html!"));
                const $ = Util.loadHTML(raw);

                let section;
                try {
                    
                    section = JSON.parse(`{"hydratable":"playlist", ${raw.split(`{"hydratable":"playlist",`)[1].split("];</script>")[0]}`);
                    
                } catch(e) {
                    throw new Error(`Could not parse playlist:\n${e.message}`);
                }

                const data = section.data
                //console.log(data)
                data.tracks = data.tracks.filter(data => data.id && data.title);
                const getMedia = (m, a) => m.media.transcodings.find(x => x.format.protocol === a);

                const info = {
                    id: data.id,
                    title: data.title,
                    url: data.permalink_url,
                    description: $('meta[property="og:description"]').attr("content"),
                    thumbnail: data.artwork_url,
                    author: {
                        profile: data.user.permalink_url,
                        username: data.user.permalink,
                        name: data.user.username,
                        urn: data.user.id,
                        verified: Boolean(data.user.verified)
                    },
                    embedURL: $('link[type="text/json+oembed"]').attr("href"),
                    embed: options && !!options.fetchEmbed ? await this.getEmbed($('link[type="text/json+oembed"]').attr("href")) : null,
                    genre: `${raw.split(',"genre":"')[1].split('"')[0]}`.replace(/\\u0026/g, "&"),
                    trackCount: data.track_count || 0,
                    tracks: data.tracks.map(m => new Song({
                            id: m.id,
                            title: m.title,
                            description: m.description,
                            thumbnail: m.artwork_url,
                            url: m.permalink_url,
                            duration: m.full_duration || m.duration,
                            playCount: m.playback_count,
                            commentsCount: m.comment_count,
                            likes: m.likes_count,
                            genre: m.genre,
                            author: {
                                name: m.user.full_name,
                                username: m.user.permalink,
                                url: m.user.permalink_url,
                                avatarURL: m.user.avatar_url,
                                urn: m.user.id,
                                verified: !!m.user.verified,
                                followers: 0,
                                following: 0
                            },
                            publishedAt: new Date(m.created_at) || null,
                            embedURL: null,
                            embed: null,
                            track: {
                                hls: getMedia(m, "hls") ? getMedia(m, "hls").url : null,
                                progressive: getMedia(m, "progressive").url
                            },
                            trackURL: getMedia(m, "progressive").url,
                            comments: []
                        }))
                };

                return resolve(info);
            } catch (e) {
                return reject(e);
            }
        });
    }

    async createAPIKey(KEY = null, fetch = true) {
        if (KEY !== false && !KEY && "SOUNDCLOUD_API_KEY" in process.env) KEY = process.env["SOUNDCLOUD_API_KEY"];
        if (!KEY && !!fetch) {
            const key = await Util.keygen();
            if (key && typeof key === "string") this.API_KEY = key;
            else this.API_KEY = null;
        } else if (KEY) {
            this.API_KEY = KEY;
            Store.set("SOUNDCLOUD_API_KEY", this.API_KEY);
        } else {
            this.API_KEY = null;
        }
    }

}

module.exports = Client;
