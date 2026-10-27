// Generates database/seed-data.json: ~40 molds with trial / revision / maintenance history,
// suppliers, users, an audit trail and login attempts. The output is deterministic (fixed PRNG seed)
// and uses day offsets relative to "today", so deadlines and maintenance dates are always current.
// The same file feeds `npm run seed` (SQL Server) and the in-browser demo backend.
//
// Usage: npm run seed:generate
const fs = require('node:fs');
const path = require('node:path');

// ---- deterministic random helpers -------------------------------------------------------------
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(20260101);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const roundTo = (n, step) => Math.round(n / step) * step;

// ---- reference data -------------------------------------------------------------------------
const users = [
    { username: 'admin', full_name: 'Alex Morgan', email: 'admin@example.com', department: 'Management', role: 'admin' },
    { username: 'engineer', full_name: 'Anna Weber', email: 'anna.weber@example.com', department: 'Tooling', role: 'engineer' },
    { username: 'viewer', full_name: 'Julia Rossi', email: 'julia.rossi@example.com', department: 'Quality', role: 'viewer' },
    { username: 'm.nowak', full_name: 'Marek Nowak', email: 'marek.nowak@example.com', department: 'Tooling', role: 'engineer' },
    { username: 'k.schmidt', full_name: 'Klara Schmidt', email: 'klara.schmidt@example.com', department: 'Production', role: 'viewer' },
    { username: 'p.becker', full_name: 'Paul Becker', email: 'paul.becker@example.com', department: 'Production', role: 'engineer', is_active: false },
];

const suppliers = [
    { name: 'Apex Toolworks', country: 'Germany', contact_email: 'sales@apex-toolworks.example' },
    { name: 'Kestrel Precision Moulds', country: 'Czechia', contact_email: 'orders@kestrel-moulds.example' },
    { name: 'Baltic Tool & Die', country: 'Poland', contact_email: 'office@baltic-tool.example' },
    { name: 'Silesia Mouldmakers', country: 'Poland', contact_email: 'quotes@silesia-moulds.example' },
    { name: 'Rhine Tooling Partners', country: 'Germany', contact_email: 'info@rhine-tooling.example' },
    { name: 'Orion Mold Engineering', country: 'Italy', contact_email: 'projects@orion-mold.example' },
    { name: 'Vistula Tooling', country: 'Poland', contact_email: 'hello@vistula-tooling.example' },
];

const projects = ['Automotive interior', 'Medical devices', 'Consumer electronics', 'Packaging', 'Home appliances', 'Industrial connectors'];
const materials = ['PP', 'ABS', 'PA66-GF30', 'PC', 'POM', 'PBT-GF30', 'PE-HD', 'TPU', 'PC/ABS', 'PA6'];
const colors = ['Natural', 'Black RAL 9005', 'Grey RAL 7035', 'White RAL 9010', 'Blue RAL 5015', 'Red RAL 3020', 'Anthracite RAL 7016'];
const operators = ['T. Kowalski', 'S. Hoffmann', 'L. Marek', 'D. Fischer', 'R. Wojcik', 'E. Bianchi'];
const technicians = ['T. Kowalski', 'H. Brandt', 'M. Zielinski', 'F. Conti', 'J. Lehmann'];

const moldNames = [
    'Air vent bezel', 'Connector housing 8-pin', 'Bottle cap 28 mm', 'Gear cover', 'Cable clip', 'Battery lid',
    'Fan shroud', 'Handle grip', 'Filter housing', 'Switch cap', 'Sensor bracket', 'Pump impeller', 'Hinge bracket',
    'Lens holder', 'Syringe barrel 5 ml', 'Wiper arm cover', 'Coupling sleeve', 'Control knob', 'Display frame',
    'Spacer ring', 'Door handle trim', 'Fuse box cover', 'Valve body', 'Terminal block', 'Cup holder insert',
    'Latch housing', 'Drain plug', 'Tube connector', 'Gasket carrier', 'Panel clip', 'Motor end cap', 'Sight glass frame',
    'Dosing cap', 'Roller guide', 'Nozzle adapter', 'Cover plate 120x80', 'Slide rail', 'Spring retainer', 'Relay base',
    'Lamp reflector',
];

const results = {
    pass: [
        'Dimensions within tolerance, cycle time 28 s, parts approved',
        'Good surface finish, no flash, cycle time 32 s',
        'Fill balanced across all cavities, weight deviation below 0.5 %',
        'First article inspection passed, ready for series production',
        'Stable process window, scrap rate 0.8 %',
    ],
    conditional: [
        'Minor flash on parting line, polish required before release',
        'Slight sink marks near ribs, adjust packing pressure and re-test',
        'Cavity 3 runs 0.04 mm oversize, within concession limit',
        'Ejector marks visible on B-surface, acceptable after pin change',
    ],
    fail: [
        'Short shots at the far end of the cavity, vents required',
        'Warpage 0.8 mm above specification, cooling needs rework',
        'Ejector marks visible on A-surface, parts rejected',
        'Weld lines at the snap hook, gate relocation required',
        'Flash on core slide, shut-off surface worn',
    ],
};
const revisionWork = [
    'Added vents at the last-fill zone',
    'Re-polished cavity surface (SPI A2)',
    'Gate relocated and enlarged by 0.3 mm',
    'Replaced ejector pins with nitrided pins',
    'Cooling channel modification to reduce warpage',
    'Core insert replaced after wear',
    'Shut-off surface reworked, flash eliminated',
    'Texture added (VDI 3400 / 24) on visible surface',
    'Draft angle increased on side walls',
    'Hot runner nozzle replaced',
];
const maintenanceWork = [
    'Preventive maintenance: cleaning, lubrication, inspection',
    'Replaced worn guide pins and bushings',
    'Ultrasonic cleaning of cooling channels',
    'Hot runner nozzle service',
    'Polished parting line, replaced seals and O-rings',
    'Checked ejector system, replaced two broken pins',
    'Descaled cooling circuit and pressure tested',
];

const pad = (n, w = 3) => String(n).padStart(w, '0');

// ---- molds ------------------------------------------------------------------------------------
// Target mix across 40 molds
const statusPlan = [
    ...Array(15).fill('active'),
    ...Array(8).fill('trial'),
    ...Array(7).fill('revision'),
    ...Array(5).fill('maintenance'),
    ...Array(5).fill('retired'),
];
// deterministic shuffle
for (let i = statusPlan.length - 1; i > 0; i--) {
    const j = int(0, i);
    [statusPlan[i], statusPlan[j]] = [statusPlan[j], statusPlan[i]];
}
const archivedCodes = new Set();

const engineers = users.filter((u) => u.role !== 'viewer' && u.is_active !== false).map((u) => u.username);
const activity = [];
const act = (user, action, entity_type, mold_code, description, minutesAgo) =>
    activity.push({ user, action, entity_type, mold_code: mold_code || null, description, offset_minutes: -Math.round(minutesAgo) });

const molds = statusPlan.map((status, i) => {
    const code = `M-${2024 + (i < 18 ? 0 : 1)}-${pad(i + 1)}`;
    const name = moldNames[i];
    const supplier = pick(suppliers).name;
    const cavities = pick([1, 1, 2, 2, 4, 4, 8, 16]);
    const startOffset = -int(status === 'trial' ? 30 : 90, status === 'trial' ? 120 : 540);
    const cost = roundTo(int(7000, 24000) + cavities * int(2500, 6500), 50);
    const mold = {
        code,
        name,
        project: pick(projects),
        status,
        supplier,
        cavities,
        material: pick(materials),
        start_offset: startOffset,
        deadline_offset: null,
        cost,
        payment_status: 'paid',
        notes: chance(0.4) ? pick(['Steel 1.2343, hardened to 48 HRC', 'Hot runner system, 4 drops', 'Customer approval required before series start', 'Sliders on both sides', 'Tool shipped on a pallet, handle with care']) : null,
        created_by: pick(engineers),
        trials: [],
        revisions: [],
        maintenance: [],
    };

    // Deadlines: open work has near deadlines (some overdue); delivered molds have old ones
    if (status === 'trial') mold.deadline_offset = int(-4, 38);
    else if (status === 'revision') mold.deadline_offset = int(-12, 30);
    else if (status === 'maintenance') mold.deadline_offset = int(-2, 24);
    else mold.deadline_offset = Math.min(startOffset + int(60, 120), -10);

    mold.payment_status =
        status === 'trial' ? pick(['unpaid', 'partial', 'partial']) : status === 'revision' ? pick(['partial', 'paid', 'unpaid']) : pick(['paid', 'paid', 'paid', 'partial']);

    // Trials: early failures, then passes
    const trialCount = status === 'trial' ? int(1, 3) : int(1, 4);
    let day = startOffset + int(25, 45);
    for (let t = 0; t < trialCount && day < -1; t++) {
        const last = t === trialCount - 1;
        let outcome;
        if (status === 'trial') outcome = last ? pick(['conditional', 'fail', 'pass']) : pick(['fail', 'conditional']);
        else outcome = last ? 'pass' : pick(['fail', 'conditional', 'conditional']);
        mold.trials.push({
            offset: day,
            material: mold.material,
            color: pick(colors),
            quantity: pick([50, 100, 150, 200, 300, 500]),
            outcome,
            result: pick(results[outcome]),
            operator: pick(operators),
        });
        day += int(10, 30);
    }

    // Revisions follow failed / conditional trials
    const needsRevision = mold.trials.filter((t) => t.outcome !== 'pass');
    needsRevision.forEach((t) => {
        if (t.offset + 5 >= -1) return;
        mold.revisions.push({
            offset: Math.min(t.offset + int(4, 12), -1),
            vendor: chance(0.7) ? supplier : pick(suppliers).name,
            work_done: pick(revisionWork),
            cost: roundTo(int(350, 6800), 10),
            payment_status: pick(['paid', 'paid', 'partial', 'unpaid']),
            notes: chance(0.3) ? 'Rework approved by engineering' : null,
        });
    });
    if (status === 'revision') {
        // A revision currently in progress
        mold.revisions.push({
            offset: -int(1, 9),
            vendor: supplier,
            work_done: pick(revisionWork),
            cost: roundTo(int(900, 7200), 10),
            payment_status: 'unpaid',
            notes: 'Waiting for the supplier to return the tool',
        });
    }

    // Maintenance
    if (status === 'active' || status === 'maintenance' || status === 'retired') {
        let m = Math.min(startOffset + int(90, 140), -20);
        while (m < -20) {
            mold.maintenance.push({
                offset: m,
                description: pick(maintenanceWork),
                technician: pick(technicians),
                status: 'completed',
                cost: roundTo(int(60, 900), 5),
            });
            m += int(80, 110);
        }
    }
    if (status === 'maintenance') {
        mold.maintenance.push({
            offset: -int(0, 3),
            description: pick(maintenanceWork),
            technician: pick(technicians),
            status: 'in_progress',
            cost: 0,
        });
    }
    if (status === 'active' && chance(0.55)) {
        mold.maintenance.push({
            offset: int(-8, 26),
            description: 'Scheduled preventive maintenance',
            technician: pick(technicians),
            status: 'planned',
            cost: 0,
        });
    }
    return mold;
});

// A few molds are archived (soft-deleted): retired tools that were removed from the register
molds
    .filter((m) => m.status === 'retired')
    .slice(0, 3)
    .forEach((m) => {
        m.archived = true;
        archivedCodes.add(m.code);
    });

// ---- audit trail -----------------------------------------------------------------------------
users.forEach((u, idx) => act('admin', 'user.create', 'user', null, `Created user ${u.username} (${u.role})`, 60 * 24 * (700 - idx)));
molds.forEach((m) => {
    const created = -(m.start_offset - int(0, 6)) * 24 * 60;
    act(m.created_by, 'mold.create', 'mold', m.code, `Created mold ${m.code} - ${m.name}`, created);
    if (chance(0.5)) act(m.created_by, 'mold.update', 'mold', m.code, `Updated mold ${m.code} (status, cost)`, created - int(60, 60 * 24 * 20));
    m.trials.forEach((t) =>
        act(pick(engineers), 'trial.create', 'trial', m.code, `Added trial to mold ${m.code}: ${t.outcome}`, -t.offset * 24 * 60 - int(30, 600)),
    );
    m.revisions.forEach((r) =>
        act(pick(engineers), 'revision.create', 'revision', m.code, `Added revision to mold ${m.code}: ${r.work_done.slice(0, 50)}`, -r.offset * 24 * 60 - int(30, 600)),
    );
    if (m.archived) act('admin', 'mold.archive', 'mold', m.code, `Archived mold ${m.code}`, int(60 * 24 * 3, 60 * 24 * 40));
});
// the audit viewer is more interesting when the newest entries are recent
for (let i = 0; i < 6; i++) {
    const m = pick(molds.filter((x) => !x.archived));
    act(pick(engineers), 'mold.update', 'mold', m.code, `Updated mold ${m.code} (notes)`, int(5, 60 * 30));
}
activity.sort((a, b) => a.offset_minutes - b.offset_minutes);

// ---- login attempts -------------------------------------------------------------------------
const ips = ['192.0.2.14', '192.0.2.55', '198.51.100.23', '198.51.100.77', '203.0.113.9'];
const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
];
const logins = [];
for (let i = 0; i < 70; i++) {
    const failed = chance(0.15);
    const username = failed ? pick(['admin', 'engineer', 'root', 'test', 'm.nowak', 'administrator']) : pick(users.filter((u) => u.is_active !== false)).username;
    const known = users.some((u) => u.username === username);
    logins.push({
        username,
        success: !failed,
        known,
        ip_address: pick(ips),
        user_agent: pick(agents),
        offset_minutes: -int(10, 60 * 24 * 21),
    });
}
logins.sort((a, b) => a.offset_minutes - b.offset_minutes);

const data = { users, suppliers, molds, activity, logins };
const out = path.join(__dirname, '..', 'database', 'seed-data.json');
fs.writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);

const count = (k) => molds.reduce((n, m) => n + m[k].length, 0);
console.log(
    `Wrote ${path.relative(process.cwd(), out)}: ${molds.length} molds (${archivedCodes.size} archived), ${count('trials')} trials, ` +
        `${count('revisions')} revisions, ${count('maintenance')} maintenance records, ${activity.length} activity entries, ${logins.length} login attempts`,
);
