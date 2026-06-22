import { DateTime, Duration } from "./luxon.js";


const ID = id => document.getElementById(id);

function _update(msg, state, draw) {
    switch(msg.type) {
    case "next-stage":
        switch(state.stage) {
        case 0:
            state.fl = parseInt(ID("fl").value);
            state.track = parseInt(ID("track").value);
            state.gs = parseInt(ID("gs").value);
            break;
        case 1:
            state.wp_name = ID("waypoint").value;
            state.wp_bearing = parseInt(ID("bearing").value);
            state.wp_distance = parseInt(ID("distance").value);
            state.wp_timestamp = (new Date()).getTime();
            break;
        case 2:
            state.dist_total = parseInt(ID("dtot").value);
            state.dist_left = parseInt(ID("dtg").value);
            state.dist_timestamp = (new Date()).getTime();
            break;
        case 3:
            state.sta = ID("sta").value;
            state.eta = ID("eta").value;
            state.tz_offset = parseInt(ID("tz").value);
            do_calculation(state);
        }
        state.stage++;
        break;
    case "prev-stage":
        state.stage--;
        break;
    }
    draw(state);
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
}

function do_calculation(state) {
    const nm_to_km = nm => (nm * 1.852).toFixed(0).toString();
    state.out = {};
    state.out.altitude = (state.fl * 0.03048).toFixed(1).toString();
    state.out.track = fuzzy_bearing(state.track);
    state.out.speed = nm_to_km(state.gs);
    state.out.s_per_km = (3600 / (state.gs * 1.852)).toFixed(1).toString();
    // intention is to update these fields based on time stamp and gs
    state.out.dist_to_run = nm_to_km(state.dist_left);
    state.out.total_dist = nm_to_km(state.dist_total);
    state.out.fraction_left = (state.dist_left / state.dist_total).toFixed(2).toString();
    // intention is to update these fields based on time stamp and gs
    state.out.wp_dist = nm_to_km(state.wp_distance);
    state.out.wp_bearing = fuzzy_bearing(state.wp_bearing + 180);
    state.out.wp_name = state.wp_name;
    // date calculation uses luxon
    let eta_z = DateTime.fromFormat(state.eta, "HHmm", { zone: "UTC" });
    let sta_z = DateTime.fromFormat(state.sta, "HHmm", { zone: "UTC" });
    let zone = state.tz_offset < 0 ? `UTC-${-state.tz_offset}` : `UTC+${state.tz_offset}`;
    state.out.eta_l = eta_z.setZone(zone).toFormat("HH:mm");
    state.out.eta_uk = eta_z.setZone("Europe/London").toFormat("HH:mm");
    state.out.now_l = DateTime.now().setZone(zone).toFormat("HH:mm");
    state.out.delay = Math.round((eta_z - sta_z) / 60000);
    console.log(state);
}

function _draw(state) {
    let sections = document.getElementsByTagName("section");
    for(let c = 0; c < sections.length; c++) {
        if(c < state.stage) {
            sections[c].classList.remove("hidden");
            for(let el of sections[c].getElementsByTagName("input")) {
                el.setAttribute("readonly", "");
            }
            for(let el of sections[c].getElementsByTagName("button")) {
                el.setAttribute("disabled", "");
            }
        } else if(c == state.stage) {
            sections[c].classList.remove("hidden");
            let inputs = sections[c].getElementsByTagName("input");
            for(let el of inputs) {
                el.removeAttribute("readonly");
            }
            for(let el of sections[c].getElementsByTagName("button")) {
                el.removeAttribute("disabled");
            }
            if(inputs.length) {
                inputs[0].focus();
            }
        } else {
            sections[c].classList.add("hidden");
        }
    }
    if(state.stage == sections.length - 1) {
        ID("o-fp-alt").innerText = state.out.altitude;
        ID("o-fp-fuzzy-trk").innerText = state.out.track;
        ID("o-fp-speed").innerText = state.out.speed;
        ID("o-fp-secs-per-km").innerText = state.out.s_per_km;
        ID("o-dist-left").innerText = state.out.dist_to_run;
        ID("o-dist-sector").innerText = state.out.total_dist;
        ID("o-dist-left-fraction").innerText = state.out.fraction_left;
        ID("o-wp-dist").innerText = state.out.wp_dist;
        ID("o-wp-fuzzy-brg-from").innerText = state.out.wp_bearing;
        ID("o-wp-name").innerText = state.out.wp_name;
        ID("o-eta-uk").innerText = state.out.eta_uk;
        ID("o-eta-l").innerText = state.out.eta_l;
        ID("o-now-l").innerText = state.out.now_l;
        ID("o-delay").innerText = state.out.delay;
    }
}

function do_wiring(update) {
    for(let i of ["fp-next", "wp-next", "d-next", "done"]) {
        ID(i).addEventListener("click", () =>
            update({type: "next-stage"}));
    }
    for(let i of ["wp-back", "d-back", "t-back", "edit"]) {
        ID(i).addEventListener("click", () =>
            update({type: "prev-stage"}));
    }
}

function main() {
    let state = {stage: 0};
    let draw = () => _draw(state);
    draw(state);
    let update = msg => _update(msg, state, draw);
    do_wiring(update);
}

window.onload = main;
