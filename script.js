"use strict";

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
            state.sta = parseInt(ID("sta").value);
            state.eta = parseInt(ID("eta").value);
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
    const nm_to_km = nm => (nm * 1.852).toFixed(2).toString();
    state.out = {};
    state.out.altitude = (state.fl * 0.03048).toFixed(2).toString();
    state.out.track = fuzzy_bearing(state.track);
    state.out.speed = nm_to_km(state.gs);
    state.out.s_per_km = (3600 / (state.gs * 1.852)).toFixed(2).toString();
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
            for(let el of sections[c].getElementsByTagName("input")) {
                el.removeAttribute("readonly");
            }
            for(let el of sections[c].getElementsByTagName("button")) {
                el.removeAttribute("disabled");
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
