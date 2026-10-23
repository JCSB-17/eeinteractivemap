const yearColors = {
    1: { background: '#e3f2fd', border: '#90caf9' },
    2: { background: '#e8f5e9', border: '#a5d6a7' },
    3: { background: '#fff3e0', border: '#ffcc80' },
    4: { background: '#fce4ec', border: '#f48fb1' }
};

// Cookie Management Functions
function setCookie(name, value) {
    document.cookie = name + "=" + (value || "") + "; path=/; max-age=31536000";
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

let completedCourses = new Set(JSON.parse(getCookie('completedCourses') || '[]'));

function getNodeColor(course) {
    const isDark = document.body.classList.contains('dark-mode');
    if (completedCourses.has(course.id)) {
        return {
            background: isDark ? '#3a3a3a' : '#ecf0f1',
            border: isDark ? '#555555' : '#bdc3c7'
        };
    }
    return yearColors[course.year];
}

function getNodeFontColor() {
    const isDark = document.body.classList.contains('dark-mode');
    return isDark ? '#ffffff' : '#000000';
}

const nodes = new vis.DataSet(
    curriculumData.map(course => {
        const level = ((course.year - 1) * 4) + course.term;
        return {
            id: course.id,
            label: course.id,
            title: course.title,
            level: level,
            color: getNodeColor(course),
            shape: 'box',
            font: { face: 'monospace', align: 'center', color: getNodeFontColor() },
            hidden: false
        };
    })
);

const edges = new vis.DataSet();

curriculumData.forEach(course => {
    if (course.prereqs) {
        course.prereqs.forEach(prereq => {
            edges.add({
                from: prereq,
                to: course.id,
                arrows: 'to',
                color: { color: '#bdc3c7' }
            });
        });
    }
    
    if (course.coreqs) {
        course.coreqs.forEach(coreq => {
            edges.add({
                from: coreq,
                to: course.id,
                arrows: 'to',
                dashes: true,
                color: { color: '#e74c3c' }
            });
        });
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
    interaction: {
        hover: true,
        navigationButtons: true,
        keyboard: true
    }
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
const cStatus = document.getElementById('c-status');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const gradProjection = document.getElementById('grad-projection');

const multiSelectToggle = document.getElementById('multi-select-toggle');
const multiSelectInfo = document.getElementById('multi-select-info');
const selectedCoursesList = document.getElementById('selected-courses-list');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const markCompletedBtn = document.getElementById('mark-completed-btn');
const markUncompletedBtn = document.getElementById('mark-uncompleted-btn');

let isMultiSelectMode = false;
let activeNodes = [];

// Graduation Projection Logic
function updateGraduationProjection() {
    const uncompleted = curriculumData.filter(c => !completedCourses.has(c.id));
    
    if (uncompleted.length === 0) {
        gradProjection.textContent = "All Subjects Completed!";
        gradProjection.style.color = "#27ae60";
        return;
    }

    const getAbsTerm = (year, term) => (year - 1) * 4 + term;
    let baseTerm = Math.min(...uncompleted.map(c => getAbsTerm(c.year, c.term)));
    let projTerms = {};

    uncompleted.forEach(course => {
        let maxPrereqTerm = 0;
        if (course.prereqs) {
            course.prereqs.forEach(p => {
                if (!completedCourses.has(p) && projTerms[p]) {
                    maxPrereqTerm = Math.max(maxPrereqTerm, projTerms[p]);
                }
            });
        }
        let standardTerm = getAbsTerm(course.year, course.term);
        projTerms[course.id] = Math.max(standardTerm, baseTerm, maxPrereqTerm + 1);
    });

    const maxAbsTerm = Math.max(...Object.values(projTerms));
    const expectedYear = Math.floor((maxAbsTerm - 1) / 4) + 1;
    const expectedTerm = ((maxAbsTerm - 1) % 4) + 1;

    gradProjection.textContent = `Year ${expectedYear}, Term ${expectedTerm}`;
    gradProjection.style.color = "";
}

function refreshNodeColors() {
    const fontColor = getNodeFontColor();
    const updates = curriculumData.map(course => ({
        id: course.id,
        color: getNodeColor(course),
        font: { color: fontColor }
    }));
    nodes.update(updates);
}

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    refreshNodeColors();
});

function saveCompletionData() {
    setCookie('completedCourses', JSON.stringify(Array.from(completedCourses)));
    refreshNodeColors();
    updateGraduationProjection();
    if (activeNodes.length > 0) {
        displayCourseDetails(activeNodes[activeNodes.length - 1]);
    }
}

markCompletedBtn.addEventListener('click', () => {
    activeNodes.forEach(id => completedCourses.add(id));
    saveCompletionData();
});

markUncompletedBtn.addEventListener('click', () => {
    activeNodes.forEach(id => completedCourses.delete(id));
    saveCompletionData();
});

multiSelectToggle.addEventListener('click', () => {
    isMultiSelectMode = !isMultiSelectMode;
    if (isMultiSelectMode) {
        multiSelectToggle.textContent = 'Disable Multi-Select Mode';
        multiSelectToggle.classList.add('active');
        multiSelectInfo.style.display = 'block';
    } else {
        multiSelectToggle.textContent = 'Enable Multi-Select Mode';
        multiSelectToggle.classList.remove('active');
        multiSelectInfo.style.display = 'none';
        if (activeNodes.length > 1) {
            activeNodes = [activeNodes[activeNodes.length - 1]];
        }
        updateFlowView();
    }
});

clearSelectionBtn.addEventListener('click', () => {
    activeNodes = [];
    selectedCoursesList.textContent = 'None';
    updateFlowView();
});

function getConnectedNodes(startNodeId) {
    const connected = new Set();
    connected.add(startNodeId);

    function traverseForward(nodeId) {
        const outEdges = edges.get({ filter: e => e.from === nodeId });
        outEdges.forEach(edge => {
            if (!connected.has(edge.to)) {
                connected.add(edge.to);
                traverseForward(edge.to);
            }
        });
    }

    function traverseBackward(nodeId) {
        const inEdges = edges.get({ filter: e => e.to === nodeId });
        inEdges.forEach(edge => {
            if (!connected.has(edge.from)) {
                connected.add(edge.from);
                traverseBackward(edge.from);
            }
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
    
    if (completedCourses.has(course.id)) {
        cStatus.textContent = "Completed";
        cStatus.className = "status-badge status-completed";
    } else {
        cStatus.textContent = "Pending";
        cStatus.className = "status-badge status-pending";
    }
    
    cPrereqs.innerHTML = '';
    if (course.prereqs.length > 0) {
        course.prereqs.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            cPrereqs.appendChild(li);
        });
    } else {
        cPrereqs.innerHTML = '<span class="empty-list">None</span>';
    }
    
    cCoreqs.innerHTML = '';
    if (course.coreqs.length > 0) {
        course.coreqs.forEach(c => {
            const li = document.createElement('li');
            li.textContent = c;
            cCoreqs.appendChild(li);
        });
    } else {
        cCoreqs.innerHTML = '<span class="empty-list">None</span>';
    }
}

function updateFlowView() {
    if (activeNodes.length === 0) {
        placeholder.style.display = 'block';
        courseCard.style.display = 'none';
        
        nodes.forEach(n => nodes.update({ id: n.id, hidden: false }));
        
        const isCurrentlyMobile = window.innerWidth <= 768;
        network.setOptions({
            layout: {
                hierarchical: {
                    direction: isCurrentlyMobile ? 'UD' : 'LR',
                    sortMethod: 'directed',
                    nodeSpacing: isCurrentlyMobile ? 120 : 80,
                    levelSeparation: isCurrentlyMobile ? 120 : 250
                }
            },
            edges: {
                smooth: { type: 'cubicBezier', forceDirection: isCurrentlyMobile ? 'vertical' : 'horizontal' }
            }
        });

        setTimeout(() => network.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } }), 50);
        return;
    }

    displayCourseDetails(activeNodes[activeNodes.length - 1]);

    const allConnected = new Set();
    activeNodes.forEach(id => {
        const connectedSet = getConnectedNodes(id);
        connectedSet.forEach(n => allConnected.add(n));
    });

    const updates = [];
    nodes.forEach(n => {
        updates.push({ id: n.id, hidden: !allConnected.has(n.id) });
    });
    nodes.update(updates);

    const isCurrentlyMobile = window.innerWidth <= 768;
    network.setOptions({
        layout: {
            hierarchical: {
                direction: isCurrentlyMobile ? 'UD' : 'LR',
                sortMethod: 'directed',
                nodeSpacing: 80,
                levelSeparation: isCurrentlyMobile ? 150 : 250
            }
        },
        edges: {
            smooth: { type: 'cubicBezier', forceDirection: isCurrentlyMobile ? 'vertical' : 'horizontal' }
        }
    });

    network.selectNodes(activeNodes);

    setTimeout(() => {
        network.fit({
            nodes: Array.from(allConnected),
            animation: { duration: 600, easingFunction: "easeInOutQuad" }
        });
    }, 50);
}

network.on("click", function (params) {
    const clickedNode = params.nodes.length > 0 ? params.nodes[0] : null;

    if (isMultiSelectMode) {
        if (clickedNode) {
            const index = activeNodes.indexOf(clickedNode);
            if (index > -1) {
                activeNodes.splice(index, 1);
            } else {
                activeNodes.push(clickedNode);
            }
            selectedCoursesList.textContent = activeNodes.length > 0 ? activeNodes.join(', ') : 'None';
            updateFlowView();
        }
    } else {
        if (clickedNode) {
            activeNodes = [clickedNode];
            updateFlowView();
        } else {
            activeNodes = [];
            updateFlowView();
        }
    }
});

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    searchResults.innerHTML = '';
    
    if (!term) return;

    const matches = curriculumData.filter(c =>
        c.id.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term)
    );

    matches.forEach(match => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = `${match.id} - ${match.title}`;
        div.onclick = () => {
            if (isMultiSelectMode) {
                if (!activeNodes.includes(match.id)) {
                    activeNodes.push(match.id);
                }
                selectedCoursesList.textContent = activeNodes.join(', ');
            } else {
                activeNodes = [match.id];
            }
            updateFlowView();
            searchResults.innerHTML = '';
            searchInput.value = '';
        };
        searchResults.appendChild(div);
    });
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.innerHTML = '';
    }
});

// Initialize Projection on load
updateGraduationProjection();
