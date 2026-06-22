"use strict";

const ID = id => document.getElementById(id);

function _update(msg, state, draw) {
    console.log("update", msg);
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

function do_calculation(state) {
    console.log(state);
}

function _draw(state) {
    console.log(state);
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
