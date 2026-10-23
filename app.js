function setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

const savedData = getCookie('completedCourses');
let completedCourses = new Set(savedData ? JSON.parse(savedData) : []);

const yearColors = {
    1: { background: '#e3f2fd', border: '#90caf9' },
    2: { background: '#e8f5e9', border: '#a5d6a7' },
    3: { background: '#fff3e0', border: '#ffcc80' },
    4: { background: '#fce4ec', border: '#f48fb1' }
};

const nodes = new vis.DataSet(
    curriculumData.map(course => {
        const level = ((course.year - 1) * 4) + course.term;
        return {
            id: course.id,
            label: course.id,
            title: course.title,
            level: level,
            shape: 'box',
            hidden: false
        };
    })
);

const edges = new vis.DataSet();

curriculumData.forEach(course => {
    if (course.prereqs) {
        course.prereqs.forEach(prereq => edges.add({ from: prereq, to: course.id, arrows: 'to', color: { color: '#bdc3c7' } }));
    }
    if (course.coreqs) {
        course.coreqs.forEach(coreq => edges.add({ from: coreq, to: course.id, arrows: 'to', dashes: true, color: { color: '#e74c3c' } }));
    }
});

const container = document.getElementById('curriculum-graph');
const data = { nodes: nodes, edges: edges };
const isMobile = window.innerWidth <= 768;

const options = {
    layout: {
        hierarchical: {
            direction: isMobile ? 'UD' : 'LR',
            sortMethod: 'directed',
            nodeSpacing: isMobile ? 120 : 80,
            levelSeparation: isMobile ? 120 : 250
        }
    },
    edges: {
        smooth: {
            type: 'cubicBezier',
            forceDirection: isMobile ? 'vertical' : 'horizontal'
        }
    },
    physics: false,
    interaction: { hover: true, navigationButtons: true, keyboard: true }
};

const network = new vis.Network(container, data, options);

const placeholder = document.getElementById('placeholder-text');
const courseCard = document.getElementById('course-card');
const cId = document.getElementById('c-id');
const cTitle = document.getElementById('c-title');
const cYear = document.getElementById('c-year');
const cTerm = document.getElementById('c-term');
const cUnits = document.getElementById('c-units');
const cPrereqs = document.getElementById('c-prereqs');
const cCoreqs = document.getElementById('c-coreqs');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

const multiSelectToggle = document.getElementById('multi-select-toggle');
const completionToggle = document.getElementById('completion-mode-toggle');
const multiSelectInfo = document.getElementById('multi-select-info');
const completionInfo = document.getElementById('completion-info');
const selectedCoursesList = document.getElementById('selected-courses-list');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const clearCompletionBtn = document.getElementById('clear-completion-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');

let isMultiSelectMode = false;
let isCompletionMode = false;
let activeNodes = [];

function updateNodeStyles() {
    const isDark = document.body.classList.contains('dark-mode');
    const updates = [];
    
    curriculumData.forEach(course => {
        const isCompleted = completedCourses.has(course.id);
        const bgColor = isCompleted ? (isDark ? '#2c3e50' : '#bdc3c7') : yearColors[course.year].background;
        const borderColor = isCompleted ? (isDark ? '#1a252f' : '#7f8c8d') : yearColors[course.year].border;
        const fontColor = isCompleted ? (isDark ? '#7f8c8d' : '#ffffff') : (isDark ? '#e0e0e0' : '#000000');
        
        updates.push({
            id: course.id,
            color: { background: bgColor, border: borderColor },
            font: { color: fontColor, face: 'monospace', align: 'center' }
        });
    });
    nodes.update(updates);
}

function updateUnitStats() {
    let total = 0;
    let completed = 0;

    curriculumData.forEach(course => {
        const courseUnits = Number(course.units) || 0;
        total += courseUnits;
        if (completedCourses.has(course.id)) {
            completed += courseUnits;
        }
    });

    document.getElementById('units-total').textContent = total;
    document.getElementById('units-completed').textContent = completed;
    document.getElementById('units-remaining').textContent = total - completed;
}

function updateGraduationEstimate() {
    const gradElement = document.getElementById('expected-graduation');
    updateUnitStats();
    
    if (completedCourses.size === curriculumData.length) {
        gradElement.textContent = "Graduated!";
        return;
    }

    // Helper functions to map original curriculum structure to absolute terms
    function getOriginalAbsTerm(y, t) {
        if (y === 1) return t; // Y1: Terms 1, 2, 3
        if (y === 2) return 3 + t; // Y2: Terms 4, 5, 6
        return 6 + ((y - 3) * 4) + t; // Y3+: Quadmester formatting starting at Term 7
    }

    function getTermInfo(absTerm) {
        // Years 1 & 2: Trimester, 21 Units Max
        if (absTerm <= 3) return { year: 1, term: absTerm, maxUnits: 21 };
        if (absTerm <= 6) return { year: 2, term: absTerm - 3, maxUnits: 21 };
        
        // Year 3 & beyond: Quadmester, 18 Units Max
        const postY2 = absTerm - 6;
        const y = 3 + Math.floor((postY2 - 1) / 4);
        const t = ((postY2 - 1) % 4) + 1;
        return { year: y, term: t, maxUnits: 18 };
    }

    // Calculate start point for the simulation based on highest completed chronological term
    let maxCompletedAbsTerm = 0;
    completedCourses.forEach(id => {
        const c = curriculumData.find(x => x.id === id);
        if (c) {
            const absTerm = getOriginalAbsTerm(c.year, c.term);
            if (absTerm > maxCompletedAbsTerm) maxCompletedAbsTerm = absTerm;
        }
    });

    let simulationAbsTerm = maxCompletedAbsTerm;
    let takenInSim = new Set(completedCourses);
    let remainingSim = curriculumData.filter(c => !takenInSim.has(c.id));

    // Priority sorting: Attempt to clear backlogs from oldest terms first
    remainingSim.sort((a, b) => getOriginalAbsTerm(a.year, a.term) - getOriginalAbsTerm(b.year, b.term));

    let loops = 0;
    // Simulate term-by-term forward progression
    while (remainingSim.length > 0 && loops < 50) {
        loops++;
        simulationAbsTerm++;
        const termInfo = getTermInfo(simulationAbsTerm);
        let unitsThisTerm = 0;
        let coursesThisTerm = [];

        let i = 0;
        while (i < remainingSim.length) {
            let course = remainingSim[i];
            let canTake = true;

            // Strict Pre-requisite validation
            if (course.prereqs) {
                for (let p of course.prereqs) {
                    if (!takenInSim.has(p)) {
                        canTake = false;
                        break;
                    }
                }
            }

            if (!canTake) { i++; continue; }

            // Dynamic Co-requisite validation & bundling
            let coreqsNeededThisTerm = [];
            if (course.coreqs) {
                for (let cReq of course.coreqs) {
                    if (!takenInSim.has(cReq) && !coursesThisTerm.includes(cReq)) {
                        let cReqObj = remainingSim.find(x => x.id === cReq);
                        if (!cReqObj) { canTake = false; break; } // Coreq missing from remaining list
                        
                        let reqPrereqMet = true;
                        if (cReqObj.prereqs) {
                            for (let rp of cReqObj.prereqs) {
                                if (!takenInSim.has(rp)) { reqPrereqMet = false; break; }
                            }
                        }
                        if (!reqPrereqMet) { canTake = false; break; }
                        coreqsNeededThisTerm.push(cReqObj);
                    }
                }
            }

            if (!canTake) { i++; continue; }

            // Enforce Strict Unit Limits for Current Term Rule (18 vs 21)
            let extraUnits = Number(course.units) || 0;
            for (let cReqObj of coreqsNeededThisTerm) extraUnits += (Number(cReqObj.units) || 0);

            if (unitsThisTerm + extraUnits <= termInfo.maxUnits) {
                coursesThisTerm.push(course.id);
                unitsThisTerm += (Number(course.units) || 0);

                for (let cReqObj of coreqsNeededThisTerm) {
                    if (!coursesThisTerm.includes(cReqObj.id)) {
                        coursesThisTerm.push(cReqObj.id);
                        unitsThisTerm += (Number(cReqObj.units) || 0);
                    }
                }

                // Isolate successfully added courses and restart scan to fill remaining unit gaps
                remainingSim = remainingSim.filter(x => !coursesThisTerm.includes(x.id));
                i = 0;
            } else {
                i++;
            }
        }

        // Commit taken subjects to pool to unlock prerequisites for next iteration
        coursesThisTerm.forEach(id => takenInSim.add(id));

        if (coursesThisTerm.length === 0 && remainingSim.length > 0) {
            console.error("Simulation Deadlock Detected: Cannot resolve remaining subjects.", remainingSim);
            break;
        }
    }

    const finalTermInfo = getTermInfo(simulationAbsTerm);
    gradElement.textContent = `Year ${finalTermInfo.year}, Term ${finalTermInfo.term}`;
}

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    updateNodeStyles();
});

multiSelectToggle.addEventListener('click', () => {
    isMultiSelectMode = !isMultiSelectMode;
    if (isCompletionMode && isMultiSelectMode) completionToggle.click();
    
    if (isMultiSelectMode) {
        multiSelectToggle.textContent = 'Disable Multi-Select Flow';
        multiSelectToggle.classList.add('active');
        multiSelectInfo.style.display = 'block';
    } else {
        multiSelectToggle.textContent = 'Enable Multi-Select Flow';
        multiSelectToggle.classList.remove('active');
        multiSelectInfo.style.display = 'none';
        if (activeNodes.length > 1) activeNodes = [activeNodes[activeNodes.length - 1]];
        updateFlowView();
    }
});

completionToggle.addEventListener('click', () => {
    isCompletionMode = !isCompletionMode;
    if (isMultiSelectMode && isCompletionMode) multiSelectToggle.click();
    
    if (isCompletionMode) {
        completionToggle.textContent = 'Exit Completion Mode';
        completionToggle.classList.add('active');
        completionInfo.style.display = 'block';
        activeNodes = [];
        updateFlowView();
    } else {
        completionToggle.textContent = 'Mark Courses Completed';
        completionToggle.classList.remove('active');
        completionInfo.style.display = 'none';
    }
});

clearSelectionBtn.addEventListener('click', () => {
    activeNodes = [];
    selectedCoursesList.textContent = 'None';
    updateFlowView();
});

clearCompletionBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset all completed courses?")) {
        completedCourses.clear();
        setCookie('completedCourses', JSON.stringify([]));
        updateNodeStyles();
        updateGraduationEstimate();
    }
});

function getConnectedNodes(startNodeId) {
    const connected = new Set();
    connected.add(startNodeId);

    function traverseForward(nodeId) {
        edges.get({ filter: e => e.from === nodeId }).forEach(edge => {
            if (!connected.has(edge.to)) { connected.add(edge.to); traverseForward(edge.to); }
        });
    }

    function traverseBackward(nodeId) {
        edges.get({ filter: e => e.to === nodeId }).forEach(edge => {
            if (!connected.has(edge.from)) { connected.add(edge.from); traverseBackward(edge.from); }
        });
    }

    traverseForward(startNodeId);
    traverseBackward(startNodeId);
    return connected;
}

function displayCourseDetails(nodeId) {
    const course = curriculumData.find(c => c.id === nodeId);
    if (!course) return;

    placeholder.style.display = 'none';
    courseCard.style.display = 'block';
    
    cId.textContent = course.id;
    cTitle.textContent = course.title;
    cYear.textContent = course.year;
    cTerm.textContent = course.term;
    cUnits.textContent = course.units;
    
    cPrereqs.innerHTML = course.prereqs.length ? course.prereqs.map(p => `<li>${p}</li>`).join('') : '<span class="empty-list">None</span>';
    cCoreqs.innerHTML = course.coreqs.length ? course.coreqs.map(c => `<li>${c}</li>`).join('') : '<span class="empty-list">None</span>';
}

function updateFlowView() {
    if (activeNodes.length === 0) {
        placeholder.style.display = 'block';
        courseCard.style.display = 'none';
        
        nodes.forEach(n => nodes.update({ id: n.id, hidden: false }));
        
        const isCurrentlyMobile = window.innerWidth <= 768;
        network.setOptions({
            layout: { hierarchical: { direction: isCurrentlyMobile ? 'UD' : 'LR', nodeSpacing: isCurrentlyMobile ? 120 : 80, levelSeparation: isCurrentlyMobile ? 120 : 250 } },
            edges: { smooth: { type: 'cubicBezier', forceDirection: isCurrentlyMobile ? 'vertical' : 'horizontal' } }
        });

        setTimeout(() => network.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } }), 50);
        return;
    }

    displayCourseDetails(activeNodes[activeNodes.length - 1]);

    const allConnected = new Set();
    activeNodes.forEach(id => getConnectedNodes(id).forEach(n => allConnected.add(n)));

    const updates = [];
    nodes.forEach(n => updates.push({ id: n.id, hidden: !allConnected.has(n.id) }));
    nodes.update(updates);

    const isCurrentlyMobile = window.innerWidth <= 768;
    network.setOptions({
        layout: { hierarchical: { direction: isCurrentlyMobile ? 'UD' : 'LR', nodeSpacing: 80, levelSeparation: isCurrentlyMobile ? 150 : 250 } },
        edges: { smooth: { type: 'cubicBezier', forceDirection: isCurrentlyMobile ? 'vertical' : 'horizontal' } }
    });

    network.selectNodes(activeNodes);
    setTimeout(() => network.fit({ nodes: Array.from(allConnected), animation: { duration: 600, easingFunction: "easeInOutQuad" } }), 50);
}

network.on("click", function (params) {
    const clickedNode = params.nodes.length > 0 ? params.nodes[0] : null;

    if (isCompletionMode) {
        if (clickedNode) {
            if (completedCourses.has(clickedNode)) completedCourses.delete(clickedNode);
            else completedCourses.add(clickedNode);
            
            setCookie('completedCourses', JSON.stringify(Array.from(completedCourses)));
            updateNodeStyles();
            updateGraduationEstimate();
            displayCourseDetails(clickedNode);
        } else {
            placeholder.style.display = 'block';
            courseCard.style.display = 'none';
        }
        return;
    }

    if (isMultiSelectMode) {
        if (clickedNode) {
            const index = activeNodes.indexOf(clickedNode);
            if (index > -1) activeNodes.splice(index, 1);
            else activeNodes.push(clickedNode);
            selectedCoursesList.textContent = activeNodes.length > 0 ? activeNodes.join(', ') : 'None';
            updateFlowView();
        }
    } else {
        activeNodes = clickedNode ? [clickedNode] : [];
        updateFlowView();
    }
});

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    searchResults.innerHTML = '';
    if (!term) return;

    curriculumData.filter(c => c.id.toLowerCase().includes(term) || c.title.toLowerCase().includes(term)).forEach(match => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = `${match.id} - ${match.title}`;
        div.onclick = () => {
            if (isCompletionMode) {
                network.focus(match.id, { scale: 1.0, animation: true });
                displayCourseDetails(match.id);
            } else if (isMultiSelectMode) {
                if (!activeNodes.includes(match.id)) activeNodes.push(match.id);
                selectedCoursesList.textContent = activeNodes.join(', ');
                updateFlowView();
            } else {
                activeNodes = [match.id];
                updateFlowView();
            }
            searchResults.innerHTML = '';
            searchInput.value = '';
        };
        searchResults.appendChild(div);
    });
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) searchResults.innerHTML = '';
});

updateNodeStyles();
updateGraduationEstimate();
