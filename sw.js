const META = {
    "VERSION": "1.35",
    "MANIFEST": [
        "index.html",
        "styles.css",
        "script.js",
        "luxon.js",
        "icon.svg",
        "icon-180.png",
        "icon-192.png",
        "pa.webmanifest"
    ]
}
const APP_ID = "pa_cache";
const CACHE = `${APP_ID}.${META["VERSION"]}`;
const LANDING_PAGE = "index.html";


async function add_files(cache) {
    await cache.addAll(META["MANIFEST"]);
    let responses = await cache.matchAll();
    let bad = responses
        .filter(r => r.headers.get("cache-control") == "no-cache")
        .filter(r => r.headers.get("x-amz-meta-version") != META["VERSION"]);
    if(bad.length) throw Error("Inconsistent");
}


self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => add_files(cache))
            .catch(err => {
                console.log(`Error initialising cache: \n${err}`);
                return Promise.reject();
            }));
});


self.addEventListener("activate", (event) => {
    event.waitUntil(Promise.all([
        caches.keys()
            .then(key_list => key_list.filter(k =>
                k.startsWith(APP_ID) && k != CACHE))
            .then(del_list => Promise.all(
                del_list.map(k => caches.delete(k)))),
        self.clients.matchAll()
            .then(clients => {
                for(let client of clients) {
                    client.navigate(LANDING_PAGE);
                }
            })
    ]));
});


self.addEventListener('fetch', event => {
    event.respondWith(
        caches.open(CACHE)
            .then(cache => cache.match(event.request.url))
            .then(response => {
                if(response) {
                    return response;
                } else {
                    console.log(`Failed to find ${event.request.url} in ${CACHE}`);
                    return new Response(null, {
                        status: 404,
                        statusText: `${event.request.url} not in ${CACHE}`
                    });
                }
            })
    );
});
