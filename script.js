import { DateTime, Duration } from "./luxon.js";


const ID = id => document.getElementById(id);


function extract_integer_fields(s, n) {
    let fields = s.split("/").map(i => parseInt(i)).filter(i => !isNaN(i));
    return fields.length == n ? fields : null;
}


function _update(msg, state, draw) {
    let fields;
    switch(msg.type) {
    case "flight-param-change":
        fields = extract_integer_fields(msg.value, 3);
        [state.fl, state.track, state.gs] =
            fields || [undefined, undefined, undefined];
        break;
    case "waypoint-change":
        fields = extract_integer_fields(msg.value, 2);
        [state.wp_bearing, state.wp_distance] = fields || [undefined, undefined];
        state.wp_timestamp = (new Date()).getTime();
        break;
    case "distances-change":
        fields = extract_integer_fields(msg.value, 2);
        [state.dist_left, state.dist_total] = fields || [undefined, undefined];
        state.dist_timestamp = (new Date()).getTime();
        break;
    case "times-change":
        fields = msg.value.split("/");
        if(fields.length == 3) {
            [state.eta, state.sta, state.tz_offset] = fields;
        } else {
            [state.eta, state.sta, state.tz_offset] = [undefined, undefined, undefined];
        }
        break;
    }
    do_calculation(state);
    draw(state);
}


function fuzzy_bearing(bearing) {
    const zones = [
        "N", "N/NE", "NE", "E/NE", "E", "E/SE", "SE", "S/SE",
        "S", "S/SW", "SW", "W/SW", "W", "W/NW", "NW", "N/NW", "N"];
    if(bearing === undefined) return "---";
    bearing = bearing % 360;
    for(let c = 0; c < zones.length; c++) {
        if(bearing < 11.25 + c * 22.5) {
            return zones[c];
        }
    }
}


function updated_waypoint_pos(state, now) {
    let wp_bearing_rads = state.wp_bearing * Math.PI / 180;
    let wp_0_i = state.wp_distance * Math.sin(wp_bearing_rads);
    let wp_0_j = state.wp_distance * Math.cos(wp_bearing_rads);
    let hours = (now - state.wp_timestamp) / 3600000;
    let track_rads = state.track * Math.PI / 180;
    let t_i = (state.gs * hours) * Math.sin(track_rads);
    let t_j = (state.gs * hours) * Math.cos(track_rads);
    let wp_t_i = wp_0_i - t_i;
    let wp_t_j = wp_0_j - t_j;
    let new_bearing = 450 - ((Math.atan2(wp_t_j, wp_t_i)) * 180 / Math.PI);
    let new_dist = Math.hypot(wp_t_j, wp_t_i);
    return [new_bearing, new_dist];
}


function do_calculation(state) {
    const nm_to_km = nm => nm ? (nm * 1.852).toFixed(0) : "---";
    state.out = {};
    let now = (new Date()).getTime();
    state.out.altitude = state.fl ? (state.fl * 0.03048).toFixed(1) : "---";
    state.out.track = fuzzy_bearing(state.track);
    state.out.speed = nm_to_km(state.gs);
    state.out.s_per_km = state.gs ? (3600 / (state.gs * 1.852)).toFixed(1) : "---";
    // update distance to run based on time since distance data entered
    let ltr = state.dist_left - state.gs * (now - state.dist_timestamp) / 3600000;
    state.out.dist_to_run = nm_to_km(ltr);
    state.out.total_dist = nm_to_km(state.dist_total);
    state.out.fraction_left = ltr && state.dist_total ?
        (ltr / state.dist_total).toFixed(2) : "---";
    // update bearing and distance based on time since waypoint data entered
    let [new_bearing, new_dist] = updated_waypoint_pos(state, now);
    state.out.wp_dist = nm_to_km(new_dist);
    state.out.wp_bearing = fuzzy_bearing(new_bearing + 180);
    state.out.wp_name = state.wp_name;
    // date calculation uses luxon
    if(state.eta && state.sta && state.tz_offset) {
        let eta_z = DateTime.fromFormat(state.eta, "HHmm", { zone: "UTC" });
        let sta_z = DateTime.fromFormat(state.sta, "HHmm", { zone: "UTC" });
        let zone = state.tz_offset < 0
            ? `UTC-${-state.tz_offset}`
            : `UTC+${state.tz_offset}`;
        state.out.eta_l = eta_z.setZone(zone).toFormat("HH:mm");
        state.out.eta_uk = eta_z.setZone("Europe/London").toFormat("HH:mm");
        state.out.now_l = DateTime.now().setZone(zone).toFormat("HH:mm");
        state.out.delay = Math.round((eta_z - sta_z) / 60000);
    }
    else {
        state.out.eta_l = state.out.eta_uk = state.out.now_l = "--:--";
        state.out.delay = "---";
    }
}


function _draw(state) {
    ID("o-fp-alt").innerText = state.out.altitude;
    ID("o-fp-fuzzy-trk").innerText = state.out.track;
    ID("o-fp-speed").innerText = state.out.speed;
    ID("o-fp-secs-per-km").innerText = state.out.s_per_km;
    ID("o-dist-left").innerText = state.out.dist_to_run;
    ID("o-dist-sector").innerText = state.out.total_dist;
    ID("o-dist-left-fraction").innerText = state.out.fraction_left;
    ID("o-wp-dist").innerText = state.out.wp_dist;
    ID("o-wp-fuzzy-brg-from").innerText = state.out.wp_bearing;
    ID("o-eta-uk").innerText = state.out.eta_uk;
    ID("o-eta-l").innerText = state.out.eta_l;
    ID("o-now-l").innerText = state.out.now_l;
    ID("o-delay").innerText = state.out.delay;
}


function do_wiring(update) {
    ID("flight").addEventListener("input", () =>
        update({type: "flight-param-change", value: ID("flight").value}));
    ID("waypoint").addEventListener("input", () =>
        update({type: "waypoint-change", value: ID("waypoint").value}));
    ID("distances").addEventListener("input", () =>
        update({type: "distances-change", value: ID("distances").value}));
    ID("times").addEventListener("input", () =>
        update({type: "times-change", value: ID("times").value}));
    ID("clear").addEventListener("click", () => {
        for(let el of document.getElementsByTagName("input")) {
            el.value = "";
        }
        reparse_all(update);
    });
}


function reparse_all(update) {
    update({type: "flight-param-change", value: ID("flight").value});
    update({type: "waypoint-change", value: ID("waypoint").value});
    update({type: "distances-change", value: ID("distances").value});
    update({type: "times-change", value: ID("times").value});
}


function main() {
    navigator?.serviceWorker?.register('sw.js').then(r => {
        r.addEventListener('updatefound', () => {
            let new_sw = r.installing;
            new_sw.addEventListener("statechange", () => {
                if(new_sw.state == "activated") {
                    window.location.reload();
                }
            });
        });
        window.setInterval(() => r.update(), 1000 * 60);
    });
    let state = {};
    let draw = () => _draw(state);
    let update = msg => _update(msg, state, draw);
    do_wiring(update);
    reparse_all(update);
    window.setInterval(() => update({type: "recalc"}), 1000 * 10);
}

window.onload = main;
