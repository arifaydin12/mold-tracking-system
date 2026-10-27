const { z } = require('zod');

// ---- primitives -------------------------------------------------------------

const dateString = z
    .string({ error: 'A date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
    .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, 'Not a valid calendar date');

/** Empty strings and undefined become null so optional form fields can be cleared. */
const emptyToNull = (schema) => z.preprocess((v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v), schema.nullable());
const optionalText = (max) => emptyToNull(z.string().trim().max(max, `At most ${max} characters`));
const optionalDate = emptyToNull(dateString);
const requiredText = (min, max, label = 'This field') =>
    z
        .string({ error: `${label} is required` })
        .trim()
        .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`);

const money = z.coerce
    .number({ error: 'Must be a number' })
    .min(0, 'Must not be negative')
    .max(1_000_000_000, 'Too large')
    .transform((n) => Math.round(n * 100) / 100);

const id = z.coerce.number().int().positive();

const ROLES = ['admin', 'engineer', 'viewer'];
const MOLD_STATUSES = ['trial', 'active', 'revision', 'maintenance', 'retired'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];
const TRIAL_OUTCOMES = ['pass', 'conditional', 'fail'];
const MAINTENANCE_STATUSES = ['planned', 'in_progress', 'completed'];

const password = z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a digit');

const email = emptyToNull(z.string().trim().max(120).email('Enter a valid email address'));

// ---- pagination -------------------------------------------------------------

const pagination = {
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
};
const order = z.enum(['asc', 'desc']).default('asc');
const optionalFilter = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

// ---- auth -------------------------------------------------------------------

const login = z.object({
    username: requiredText(1, 50, 'Username'),
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
});

const changePassword = z
    .object({ current_password: z.string().min(1, 'Current password is required'), new_password: password })
    .refine((v) => v.current_password !== v.new_password, {
        path: ['new_password'],
        message: 'New password must differ from the current password',
    });

const updateProfile = z
    .object({
        full_name: requiredText(2, 100, 'Full name'),
        email,
        department: optionalText(60),
    })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

// ---- users ------------------------------------------------------------------

const username = z
    .string({ error: 'Username is required' })
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9._-]+$/, 'Use lowercase letters, digits, dot, dash or underscore');

const createUser = z.object({
    username,
    password,
    full_name: requiredText(2, 100, 'Full name'),
    email: email.optional().default(null),
    department: optionalText(60).optional().default(null),
    role: z.enum(ROLES).default('viewer'),
});

const updateUser = z
    .object({
        full_name: requiredText(2, 100, 'Full name'),
        email,
        department: optionalText(60),
        role: z.enum(ROLES),
        is_active: z.boolean(),
    })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const resetPassword = z.object({ new_password: password });

const listUsers = z.object({
    ...pagination,
    search: optionalFilter(z.string().trim().max(100)),
    role: optionalFilter(z.enum(ROLES)),
    is_active: optionalFilter(z.enum(['true', 'false']).transform((v) => v === 'true')),
    sort: z.enum(['username', 'full_name', 'role', 'created_at', 'last_login_at']).default('full_name'),
    order,
});

// ---- suppliers --------------------------------------------------------------

const supplierBase = z.object({
    name: requiredText(2, 100, 'Name'),
    country: optionalText(60),
    contact_email: email,
});
const createSupplier = supplierBase.extend({ country: optionalText(60).optional().default(null), contact_email: email.optional().default(null) });
const updateSupplier = supplierBase.partial().refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

// ---- molds ------------------------------------------------------------------

const moldFields = {
    code: requiredText(2, 50, 'Code').regex(/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/, 'Use letters, digits and . _ - / only'),
    name: requiredText(2, 150, 'Name'),
    project: optionalText(100),
    status: z.enum(MOLD_STATUSES),
    supplier_id: emptyToNull(id),
    cavities: z.coerce.number({ error: 'Must be a number' }).int('Must be a whole number').min(1, 'At least 1').max(128, 'At most 128'),
    material: optionalText(100),
    start_date: optionalDate,
    deadline: optionalDate,
    cost: money,
    payment_status: z.enum(PAYMENT_STATUSES),
    notes: optionalText(5000),
};

const deadlineAfterStart = (v) => !v.start_date || !v.deadline || v.deadline >= v.start_date;
const deadlineIssue = { path: ['deadline'], message: 'Deadline must not be before the start date' };

const createMold = z
    .object({
        ...moldFields,
        project: moldFields.project.optional().default(null),
        status: moldFields.status.default('trial'),
        supplier_id: moldFields.supplier_id.optional().default(null),
        cavities: moldFields.cavities.default(1),
        material: moldFields.material.optional().default(null),
        start_date: moldFields.start_date.optional().default(null),
        deadline: moldFields.deadline.optional().default(null),
        cost: moldFields.cost.default(0),
        payment_status: moldFields.payment_status.default('unpaid'),
        notes: moldFields.notes.optional().default(null),
    })
    .refine(deadlineAfterStart, deadlineIssue);

const updateMold = z
    .object(moldFields)
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update')
    .refine(deadlineAfterStart, deadlineIssue);

const listMolds = z.object({
    ...pagination,
    search: optionalFilter(z.string().trim().max(100)),
    status: optionalFilter(z.enum(MOLD_STATUSES)),
    supplier_id: optionalFilter(id),
    payment_status: optionalFilter(z.enum(PAYMENT_STATUSES)),
    archived: z.enum(['false', 'true', 'all']).default('false'),
    sort: z.enum(['code', 'name', 'status', 'deadline', 'cost', 'created_at', 'supplier']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
});

// ---- mold history records ---------------------------------------------------

const trialFields = {
    trial_date: dateString,
    material: optionalText(100),
    color: optionalText(50),
    quantity: z.coerce.number({ error: 'Must be a number' }).int('Must be a whole number').min(0).max(10_000_000),
    outcome: z.enum(TRIAL_OUTCOMES),
    result: optionalText(5000),
    operator: optionalText(100),
};
const createTrial = z.object({
    ...trialFields,
    material: trialFields.material.optional().default(null),
    color: trialFields.color.optional().default(null),
    quantity: trialFields.quantity.default(0),
    outcome: trialFields.outcome.default('pass'),
    result: trialFields.result.optional().default(null),
    operator: trialFields.operator.optional().default(null),
});

const revisionFields = {
    revision_date: dateString,
    vendor: optionalText(100),
    work_done: requiredText(2, 5000, 'Work done'),
    cost: money,
    payment_status: z.enum(PAYMENT_STATUSES),
    notes: optionalText(5000),
};
const createRevision = z.object({
    ...revisionFields,
    vendor: revisionFields.vendor.optional().default(null),
    cost: revisionFields.cost.default(0),
    payment_status: revisionFields.payment_status.default('unpaid'),
    notes: revisionFields.notes.optional().default(null),
});

const maintenanceFields = {
    maintenance_date: dateString,
    description: requiredText(2, 5000, 'Description'),
    technician: optionalText(100),
    status: z.enum(MAINTENANCE_STATUSES),
    cost: money,
};
const createMaintenance = z.object({
    ...maintenanceFields,
    technician: maintenanceFields.technician.optional().default(null),
    status: maintenanceFields.status.default('completed'),
    cost: maintenanceFields.cost.default(0),
});

const atLeastOne = (shape) =>
    z.object(shape).partial().refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

// ---- logs -------------------------------------------------------------------

const dateTime = z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
);

const listActivityLogs = z.object({
    ...pagination,
    search: optionalFilter(z.string().trim().max(100)),
    user_id: optionalFilter(id),
    action: optionalFilter(z.string().trim().max(50)),
    entity_type: optionalFilter(z.string().trim().max(50)),
    from: dateTime,
    to: dateTime,
});

const listLoginLogs = z.object({
    ...pagination,
    search: optionalFilter(z.string().trim().max(100)),
    success: optionalFilter(z.enum(['true', 'false']).transform((v) => v === 'true')),
    from: dateTime,
    to: dateTime,
});

const idParams = z.object({ id });
const childParams = z.object({ id, recordId: id });

module.exports = {
    ROLES,
    MOLD_STATUSES,
    PAYMENT_STATUSES,
    TRIAL_OUTCOMES,
    MAINTENANCE_STATUSES,
    schemas: {
        login,
        changePassword,
        updateProfile,
        createUser,
        updateUser,
        resetPassword,
        listUsers,
        createSupplier,
        updateSupplier,
        createMold,
        updateMold,
        listMolds,
        createTrial,
        updateTrial: atLeastOne(trialFields),
        createRevision,
        updateRevision: atLeastOne(revisionFields),
        createMaintenance,
        updateMaintenance: atLeastOne(maintenanceFields),
        listActivityLogs,
        listLoginLogs,
        idParams,
        childParams,
    },
};
