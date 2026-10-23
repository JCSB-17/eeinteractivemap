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
            color: yearColors[course.year],
            shape: 'box',
            font: { face: 'monospace', align: 'center' },
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
                color: { color: '#bdc3c7' },
                smooth: { type: 'cubicBezier', forceDirection: 'vertical' }
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
                color: { color: '#e74c3c' },
                smooth: { type: 'cubicBezier', forceDirection: 'vertical' }
            });
        });
    }
});

const container = document.getElementById('curriculum-graph');
const data = { nodes: nodes, edges: edges };
const options = {
    layout: {
        hierarchical: {
            direction: 'UD',
            sortMethod: 'directed',
            nodeSpacing: 120,
            levelSeparation: 120
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
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

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

function handleNodeSelect(nodeId) {
    const course = curriculumData.find(c => c.id === nodeId);
    
    if (course) {
        placeholder.style.display = 'none';
        courseCard.style.display = 'block';
        
        cId.textContent = course.id;
        cTitle.textContent = course.title;
        cYear.textContent = course.year;
        cTerm.textContent = course.term;
        cUnits.textContent = course.units;
        
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

        const connectedSet = getConnectedNodes(nodeId);
        const updates = [];
        nodes.forEach(n => {
            updates.push({ id: n.id, hidden: !connectedSet.has(n.id) });
        });
        nodes.update(updates);

        if (window.innerWidth <= 768) {
            network.setOptions({
                layout: {
                    hierarchical: {
                        direction: 'UD',
                        sortMethod: 'directed',
                        nodeSpacing: 80,
                        levelSeparation: 150
                    }
                },
                edges: {
                    smooth: { type: 'cubicBezier', forceDirection: 'vertical' }
                }
            });
        } else {
            network.setOptions({
                layout: {
                    hierarchical: {
                        direction: 'LR',
                        sortMethod: 'directed',
                        nodeSpacing: 80,
                        levelSeparation: 250
                    }
                },
                edges: {
                    smooth: { type: 'cubicBezier', forceDirection: 'horizontal' }
                }
            });
        }

        setTimeout(() => {
            network.fit({
                nodes: Array.from(connectedSet),
                animation: {
                    duration: 600,
                    easingFunction: "easeInOutQuad"
                }
            });
        }, 50);
    }
}

function handleNodeDeselect() {
    placeholder.style.display = 'block';
    courseCard.style.display = 'none';
    const updates = [];
    nodes.forEach(n => {
        updates.push({ id: n.id, hidden: false });
    });
    nodes.update(updates);

    network.setOptions({
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                nodeSpacing: 120,
                levelSeparation: 120
            }
        },
        edges: {
            smooth: { type: 'cubicBezier', forceDirection: 'vertical' }
        }
    });

    setTimeout(() => {
        network.fit({
            animation: {
                duration: 600,
                easingFunction: "easeInOutQuad"
            }
        });
    }, 50);
}

network.on("selectNode", function (params) {
    handleNodeSelect(params.nodes[0]);
});

network.on("deselectNode", function () {
    handleNodeDeselect();
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
            network.selectNodes([match.id]);
            handleNodeSelect(match.id);
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
