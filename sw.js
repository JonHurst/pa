const VERSION = "1.30";
const UID = "pa_cache";
const CACHE = `${UID}.${VERSION}`;
const SAFE_PAGE = "index.html";
const MANIFEST = [
    "index.html",
    "styles.css",
    "script.js",
    "luxon.js",
    "icon.svg",
    "icon-180.png",
    "icon-192.png",
    "pa.webmanifest"
];


self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(MANIFEST))
            .catch(err => {
                console.log(`Error initialising cache: \n${err}`);
                return Promise.reject();
            }));
});


self.addEventListener("activate", (event) => {
    event.waitUntil(Promise.all([
        caches.keys()
            .then(key_list => key_list.filter(k =>
                k.startsWith(UID) && k != CACHE))
            .then(del_list => Promise.all(
                del_list.map(k => caches.delete(k)))),
        self.clients.matchAll()
            .then(clients => {
                for(let client of clients) {
                    client.navigate(SAFE_PAGE);
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
