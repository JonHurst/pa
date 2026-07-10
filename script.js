import { DateTime, Duration } from "./luxon.js";


const ID = id => document.getElementById(id);


function extract_integer_fields(s, n) {
    let fields = s.trim().split(/\s+/)
        .map(i => Number(i))
        .filter(i => !isNaN(i));
    return fields.length == n ? fields : null;
}


function _update(msg, state, draw) {
    let fields;
    switch(msg.type) {
    case "flight-param-change":
        state.valid_flight = false;
        fields = extract_integer_fields(msg.value, 3);
        if(fields) {
            [state.fl, state.track, state.gs] = fields;
            state.valid_flight = true;
        }
        break;
    case "waypoint-change":
        state.valid_waypoint = false;
        fields = extract_integer_fields(msg.value, 2);
        if(fields) {
            [state.wp_bearing, state.wp_distance] = fields;
            state.wp_timestamp = (new Date()).getTime();
            state.valid_waypoint = true;
        }
        break;
    case "distances-change":
        state.valid_distances = false;
        fields = extract_integer_fields(msg.value, 2);
        if(fields) {
            [state.dist_total, state.dist_left] = fields;
            state.dist_timestamp = (new Date()).getTime();
            state.valid_distances = true;
        }
        break;
    case "times-change":
        state.valid_times = false;
        fields = msg.value.trim().split(/\s+/);
        if(fields.length == 3) {
            state.tz_offset = Number(fields[0]);
            state.sta = DateTime.fromFormat(fields[1], "HHmm", { zone: "UTC" });
            state.eta = DateTime.fromFormat(fields[2], "HHmm", { zone: "UTC" });
            if(!isNaN(state.tz_offset) && state.sta.isValid && state.eta.isValid) {
                // times more than 6 hours before now assumed to mean tomorrow
                if(state.sta.diffNow() < -6 * 3600 * 1000) {
                    state.sta = state.sta.plus({days: 1});
                }
                if(state.eta.diffNow() < -6 * 3600 * 1000) {
                    state.eta = state.eta.plus({days: 1});
                }
                state.valid_times = true;
            }
        }
        break;
    }
    draw(do_calculation(state),
         {f: state.valid_flight, w: state.valid_waypoint,
          d: state.valid_distances, t: state.valid_times});
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
        out.altitude = (state.fl * 0.01894).toFixed(1);
        out.track = fuzzy_bearing(state.track);
        let speed = state.gs * 1.151;
        out.speed = speed.toFixed(0);
        out.inverse_speed = speed ? (3600 / speed).toFixed(1) : "---";
    } else {
        out.altitude = out.track = out.speed = out.inverse_speed = "---";
    }
    // update distance to run based on time since distance data entered
    if(state.valid_flight && state.valid_distances) {
        let ltr = state.dist_left - state.gs *
            (now - state.dist_timestamp) / 3600000;
        // don't allow distance left to run to go negative
        if(ltr < 0) {
            ltr = 0;
        }
        let completed = state.dist_total - ltr;
        out.dist_left = (ltr * 1.151).toFixed(0);
        out.dist_completed = (completed * 1.151).toFixed(0);
        out.total_dist = (state.dist_total * 1.151).toFixed(0);
        out.fraction = state.dist_total ?
            ((state.dist_total - ltr) / state.dist_total).toFixed(2) : "---";
    } else {
        out.dist_left = out.dist_completed = out.total_dist = out.fraction = "---";
    }
    // update bearing and distance based on time since waypoint data entered
    if(state.valid_flight && state.valid_waypoint) {
        let [new_bearing, new_dist] = updated_waypoint_pos(state, now);
        out.wp_dist = (new_dist * 1.151).toFixed(0);
        out.wp_bearing = fuzzy_bearing(new_bearing + 180);
    } else {
        out.wp_dist = out.wp_bearing = "---";
    }
    // date calculation using luxon
    if(state.valid_times) {
        let zone = state.tz_offset < 0
            ? `UTC-${-state.tz_offset}`
            : `UTC+${state.tz_offset}`;
        out.eta_l = state.eta.setZone(zone).toFormat("HH:mm");
        out.eta_uk = state.eta.setZone("Europe/London").toFormat("HH:mm");
        out.now_l = DateTime.now().setZone(zone).toFormat("HH:mm");
        let left = state.eta.diff(DateTime.now().set({second: 0, millisecond: 0}));
        out.time_left = left > 0 ? left.toFormat("h:mm") : "-:--";
        let delay = state.eta.diff(state.sta);
        out.delay = delay > 0 ? delay.toFormat("h:mm") + " late":
            delay.negate().toFormat("h:mm") + " early";
    }
    else {
        out.eta_l = out.eta_uk = out.now_l = "--:--";
        out.delay = out.time_left = "-:--";
    }
    return out;
}


function draw(out, input_validity) {
    for(let [id, val] of [
        ["o-wp-dist", out.wp_dist], ["o-wp-fuzzy-brg-from", out.wp_bearing],
        ["o-fp-alt", out.altitude], ["o-fp-fuzzy-trk", out.track],
        ["o-fp-speed", out.speed], ["o-inverse-speed", out.inverse_speed],
        ["o-dist-left", out.dist_left], ["o-dist-completed", out.dist_completed],
        ["o-dist-sector", out.total_dist], ["o-fraction", out.fraction],
        ["o-eta-uk", out.eta_uk], ["o-eta-l", out.eta_l],
        ["o-now-l", out.now_l], ["o-time-left", out.time_left],
        ["o-delay", out.delay]
    ]) {
        ID(id).innerText = val;
    }
    for(let [id, val] of [
        ["flight", input_validity.f], ["waypoint", input_validity.w],
        ["distances", input_validity.d], ["times", input_validity.t]]) {
        if(val) {
            ID(id).classList.add("valid");
        } else {
            ID(id).classList.remove("valid");
        }
    }
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
        ID("flight").focus();
        reparse_all(update);
    });
    ID("help").addEventListener("click", () => {
        ID("help-modal").showModal();
        ID("help-scroll-container").focus();
    });
    ID("close-modal").addEventListener("click", () => {
        ID("help-modal").close();
    });
}


function reparse_all(update) {
    update({type: "flight-param-change", value: ID("flight").value});
    update({type: "waypoint-change", value: ID("waypoint").value});
    update({type: "distances-change", value: ID("distances").value});
    update({type: "times-change", value: ID("times").value});
}


function main() {
    navigator?.serviceWorker?.register('sw.js');
    let state = {};
    let update = msg => _update(msg, state, draw);
    do_wiring(update);
    reparse_all(update);
    window.setInterval(() => update({type: "recalc"}), 1000 * 10);
}

window.onload = main;
