const CACHE = 'pa_cache.1.26';
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


self.addEventListener('install', evt => {
    self.skipWaiting();
    evt.waitUntil(
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
                k.startsWith("pa_cache") && k != CACHE))
            .then(del_list => Promise.all(
                del_list.map(k => caches.delete(k)))),
        self.clients.matchAll()
            .then(clients => {
                for(let client of clients) {
                    console.log("Refreshing client");
                    client.navigate("index.html");
                }
            })
    ]));
});


self.addEventListener('fetch', evt => {
    evt.respondWith(
        caches.open(CACHE)
            .then(cache => cache.match(evt.request.url)));
});
