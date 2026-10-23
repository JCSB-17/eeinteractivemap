const yearColors = {
    1: { background: '#e3f2fd', border: '#90caf9' },
    2: { background: '#e8f5e9', border: '#a5d6a7' },
    3: { background: '#fff3e0', border: '#ffcc80' },
    4: { background: '#fce4ec', border: '#f48fb1' }
};

let completedCourses = new Set(JSON.parse(localStorage.getItem('completedCourses')) || []);

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

function updateGraduationEstimate() {
    const gradElement = document.getElementById('expected-graduation');
    
    if (completedCourses.size === 0) {
        gradElement.textContent = "Year 4, Term 3";
        return;
    }
    if (completedCourses.size === curriculumData.length) {
        gradElement.textContent = "Graduated!";
        return;
    }

    let maxCompletedLevel = 0;
    completedCourses.forEach(id => {
        const c = curriculumData.find(course => course.id === id);
        if (c) {
            const lvl = ((c.year - 1) * 4) + c.term;
            if (lvl > maxCompletedLevel) maxCompletedLevel = lvl;
        }
    });

    const nextTerm = maxCompletedLevel + 1;
    const levels = {};
    
    curriculumData.forEach(c => {
        if (!completedCourses.has(c.id)) {
            let officialLevel = ((c.year - 1) * 4) + c.term;
            levels[c.id] = officialLevel < nextTerm ? nextTerm : officialLevel;
        }
    });

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
        changed = false;
        iterations++;
        curriculumData.forEach(c => {
            if (!completedCourses.has(c.id)) {
                let maxPrereqLevel = 0;
                
                c.prereqs.forEach(pId => {
                    if (!completedCourses.has(pId) && levels[pId] !== undefined) {
                        if (levels[pId] > maxPrereqLevel) maxPrereqLevel = levels[pId];
                    }
                });
                
                if (maxPrereqLevel > 0 && maxPrereqLevel + 1 > levels[c.id]) {
                    levels[c.id] = maxPrereqLevel + 1;
                    changed = true;
                }
                
                c.coreqs.forEach(coreqId => {
                    if (!completedCourses.has(coreqId) && levels[coreqId] !== undefined) {
                        if (levels[coreqId] > levels[c.id]) {
                            levels[c.id] = levels[coreqId];
                            changed = true;
                        }
                    }
                });
            }
        });
    }

    let maxLevel = 0;
    for (let id in levels) {
        if (levels[id] > maxLevel) maxLevel = levels[id];
    }

    const expYear = Math.ceil(maxLevel / 4);
    const expTerm = maxLevel % 4 === 0 ? 4 : maxLevel % 4;

    gradElement.textContent = `Year ${expYear}, Term ${expTerm}`;
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
    if(confirm("Are you sure you want to reset all completed courses?")) {
        completedCourses.clear();
        localStorage.setItem('completedCourses', JSON.stringify([]));
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
            
            localStorage.setItem('completedCourses', JSON.stringify(Array.from(completedCourses)));
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

// Initialization Commands
updateNodeStyles();
updateGraduationEstimate();
