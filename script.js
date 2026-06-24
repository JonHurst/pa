import { DateTime, Duration } from "./luxon.js";


const ID = id => document.getElementById(id);


function extract_integer_fields(s, n) {
    let fields = s.split(/\s+/)
        .map(i => parseInt(i))
        .filter(i => !isNaN(i));
    return fields.length == n ? fields : null;
}


function _update(msg, state, draw) {
    let fields;
    switch(msg.type) {
    case "flight-param-change":
        fields = extract_integer_fields(msg.value, 3);
        if(fields) {
            [state.fl, state.track, state.gs] = fields;
            state.valid_flight = true;
        } else {
            state.valid_flight = false;
        }
        break;
    case "waypoint-change":
        fields = extract_integer_fields(msg.value, 2);
        if(fields) {
            [state.wp_bearing, state.wp_distance] = fields;
            state.wp_timestamp = (new Date()).getTime();
            state.valid_waypoint = true;
        } else {
            state.valid_waypoint = false;
        }
        break;
    case "distances-change":
        fields = extract_integer_fields(msg.value, 2);
        if(fields) {
            [state.dist_left, state.dist_total] = fields;
            state.dist_timestamp = (new Date()).getTime();
            state.valid_distances = true;
        } else {
            state.valid_distances = false;
        }
        break;
    case "times-change":
        fields = msg.value.trim().split(/\s+/);
        if(fields.length == 3) {
            [state.eta, state.sta, state.tz_offset] = fields;
            state.valid_times = true;
        } else {
            state.valid_times = false;
        }
        break;
    }
    draw(do_calculation(state));
}


function fuzzy_bearing(bearing) {
    const zones = [
        "N", "N/NE", "NE", "E/NE", "E", "E/SE", "SE", "S/SE",
        "S", "S/SW", "SW", "W/SW", "W", "W/NW", "NW", "N/NW", "N"];
    bearing = bearing % 360;
    for(let c = 0; c < zones.length; c++) {
        if(bearing < 11.25 + c * 22.5) {
            return zones[c];
        }
    }
    throw new Error("Function fuzzy_bearing should never reach here!");
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
    let out = {};
    let now = (new Date()).getTime();
    if(state.valid_flight) {
        out.altitude = (state.fl * 0.03048).toFixed(1);
        out.track = fuzzy_bearing(state.track);
        out.speed = (state.gs * 1.852).toFixed(0);
        out.s_per_km = state.gs ? (3600 / (state.gs * 1.852)).toFixed(1) : "---";
    } else {
        out.altitude = out.track = out.speed = out.s_per_km = "---";
    }
    // update distance to run based on time since distance data entered
    if(state.valid_flight && state.valid_distances) {
        let ltr = state.dist_left - state.gs *
            (now - state.dist_timestamp) / 3600000;
        out.dist_to_run = (ltr * 1.852).toFixed(0);
        out.total_dist = (state.dist_total*1.852).toFixed(0);
        out.fraction_left = state.dist_total ?
            (ltr / state.dist_total).toFixed(2) : "---";
    } else {
        out.dist_to_run = out.total_dist = out.fraction_left = "---";
    }
    // update bearing and distance based on time since waypoint data entered
    if(state.valid_flight && state.valid_waypoint) {
        let [new_bearing, new_dist] = updated_waypoint_pos(state, now);
        out.wp_dist = (new_dist * 1.852).toFixed(0);
        out.wp_bearing = fuzzy_bearing(new_bearing + 180);
    } else {
        out.wp_dist = out.wp_bearing = "---";
    }
    // date calculation uses luxon
    if(state.valid_times) {
        let eta_z = DateTime.fromFormat(state.eta, "HHmm", { zone: "UTC" });
        let sta_z = DateTime.fromFormat(state.sta, "HHmm", { zone: "UTC" });
        let zone = state.tz_offset < 0
            ? `UTC-${-state.tz_offset}`
            : `UTC+${state.tz_offset}`;
        out.eta_l = eta_z.setZone(zone).toFormat("HH:mm");
        out.eta_uk = eta_z.setZone("Europe/London").toFormat("HH:mm");
        out.now_l = DateTime.now().setZone(zone).toFormat("HH:mm");
        out.delay = Math.round((eta_z - sta_z) / 60000);
    }
    else {
        out.eta_l = out.eta_uk = out.now_l = "--:--";
        out.delay = "---";
    }
    return out;
}


function draw(out) {
    ID("o-fp-alt").innerText = out.altitude;
    ID("o-fp-fuzzy-trk").innerText = out.track;
    ID("o-fp-speed").innerText = out.speed;
    ID("o-fp-secs-per-km").innerText = out.s_per_km;
    ID("o-dist-left").innerText = out.dist_to_run;
    ID("o-dist-sector").innerText = out.total_dist;
    ID("o-dist-left-fraction").innerText = out.fraction_left;
    ID("o-wp-dist").innerText = out.wp_dist;
    ID("o-wp-fuzzy-brg-from").innerText = out.wp_bearing;
    ID("o-eta-uk").innerText = out.eta_uk;
    ID("o-eta-l").innerText = out.eta_l;
    ID("o-now-l").innerText = out.now_l;
    ID("o-delay").innerText = out.delay;
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
    let update = msg => _update(msg, state, draw);
    do_wiring(update);
    reparse_all(update);
    window.setInterval(() => update({type: "recalc"}), 1000 * 10);
}

window.onload = main;
