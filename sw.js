const CACHE = 'pa_cache.1.11';
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
    event.waitUntil(
        caches.keys()
            .then(key_list => key_list.filter(k =>
                k.startsWith("pa_cache") && k != CACHE))
            .then(del_list => Promise.all(
                del_list.map(k => caches.delete(k))
            ))
    );
});


self.addEventListener('fetch', evt => {
    evt.respondWith(
        caches.open(CACHE)
            .then(cache => cache.match(evt.request.url))
            .then(response => {
                if(response) {
                    return response;
                } else {
                    return new Response(null, {status: 404, statusText: "Not Found"});
                }
            }));
});
