export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CareerBridge Foundation API',
    description: 'Admin and Reviewer API for the CareerBridge platform. All endpoints require authentication via Supabase session cookies.',
    version: '1.0.0',
    contact: { email: 'jobsimulatorai@gmail.com' },
  },
  servers: [{ url: '/api', description: 'API base' }],
  tags: [
    { name: 'Admin – Simulations',  description: 'CRUD for simulation content'         },
    { name: 'Admin – Team',         description: 'Manage team members and permissions'  },
    { name: 'Reviewer – Simulations', description: 'Discipline-filtered review queue'   },
    { name: 'Auth',                 description: 'Session and authentication helpers'   },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
        description: 'Supabase session cookie set on login',
      },
    },
    schemas: {
      AdminPermissions: {
        type: 'object',
        properties: {
          canManageSimulations: { type: 'boolean' },
          canManageUsers:       { type: 'boolean' },
          canViewAnalytics:     { type: 'boolean' },
          canExportData:        { type: 'boolean' },
        },
      },
      TeamMember: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          user_id:     { type: 'string', format: 'uuid' },
          email:       { type: 'string', format: 'email' },
          role:        { type: 'string', enum: ['admin', 'super_admin', 'reviewer'] },
          permissions: { $ref: '#/components/schemas/AdminPermissions' },
          disciplines: { type: 'array', items: { type: 'string' }, description: 'Reviewer only' },
          granted_by:  { type: 'string', format: 'uuid', nullable: true },
          created_at:  { type: 'string', format: 'date-time' },
        },
      },
      Simulation: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          slug:        { type: 'string' },
          title:       { type: 'string' },
          discipline:  { type: 'string', nullable: true },
          cert_status: { type: 'string', enum: ['pending', 'certified', 'rejected'] },
          cert_notes:  { type: 'string', nullable: true },
          certified_by: { type: 'string', format: 'uuid', nullable: true },
          certified_at: { type: 'string', format: 'date-time', nullable: true },
          is_published: { type: 'boolean' },
          created_at:  { type: 'string', format: 'date-time' },
        },
      },
      SimulationPrompt: {
        type: 'object',
        properties: {
          id:            { type: 'string' },
          simulation_id: { type: 'string', format: 'uuid' },
          type:          { type: 'string' },
          title:         { type: 'string' },
          question:      { type: 'string' },
          guidance:      { type: 'array', items: { type: 'string' } },
          display_order: { type: 'integer' },
          min_words:     { type: 'integer', nullable: true },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    // ── Admin Team ───────────────────────────────────────────
    '/admin/team': {
      get: {
        tags: ['Admin – Team'],
        summary: 'List all team members',
        description: 'Returns all non-candidate role records, enriched with disciplines for reviewers. Requires canManageUsers or super_admin.',
        responses: {
          200: {
            description: 'List of team members',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    members: { type: 'array', items: { $ref: '#/components/schemas/TeamMember' } },
                  },
                },
              },
            },
          },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        tags: ['Admin – Team'],
        summary: 'Add a team member',
        description: 'Resolves user by email, upserts into user_roles. Requires canManageUsers or super_admin.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email:       { type: 'string', format: 'email' },
                  role:        { type: 'string', enum: ['admin', 'reviewer'] },
                  permissions: { $ref: '#/components/schemas/AdminPermissions' },
                  disciplines: { type: 'array', items: { type: 'string' }, description: 'Required when role is reviewer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Member added', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } },
          400: { description: 'Bad request' },
          403: { description: 'Forbidden' },
          404: { description: 'User not found' },
        },
      },
    },
    '/admin/team/{userId}': {
      put: {
        tags: ['Admin – Team'],
        summary: 'Update a team member',
        description: 'Updates role, permissions, and/or disciplines. Cannot modify super_admin accounts.',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role:        { type: 'string', enum: ['admin', 'reviewer'] },
                  permissions: { $ref: '#/components/schemas/AdminPermissions' },
                  disciplines: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated' },
          403: { description: 'Forbidden or cannot modify super_admin' },
        },
      },
      delete: {
        tags: ['Admin – Team'],
        summary: 'Remove a team member',
        description: 'Deletes from user_roles and reviewer_disciplines. Cannot remove super_admin accounts.',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Removed' },
          403: { description: 'Forbidden or cannot remove super_admin' },
        },
      },
    },

    // ── Reviewer Simulations ─────────────────────────────────
    '/reviewer/simulations': {
      get: {
        tags: ['Reviewer – Simulations'],
        summary: 'List simulations for this reviewer',
        description: 'Returns simulations matching the reviewer\'s assigned disciplines, plus any unclassified simulations.',
        responses: {
          200: {
            description: 'Filtered simulation list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    simulations: { type: 'array', items: { $ref: '#/components/schemas/Simulation' } },
                    disciplines: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          403: { description: 'Not a reviewer' },
        },
      },
    },
    '/reviewer/simulations/{slug}': {
      get: {
        tags: ['Reviewer – Simulations'],
        summary: 'Get simulation detail with prompts and rubric',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Simulation detail',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    simulation: { $ref: '#/components/schemas/Simulation' },
                    prompts:    { type: 'array', items: { $ref: '#/components/schemas/SimulationPrompt' } },
                    rubric:     { type: 'object', nullable: true },
                  },
                },
              },
            },
          },
          403: { description: 'Discipline mismatch or not a reviewer' },
          404: { description: 'Simulation not found' },
        },
      },
    },
    '/reviewer/simulations/{slug}/certify': {
      post: {
        tags: ['Reviewer – Simulations'],
        summary: 'Set certification status',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['certified', 'rejected', 'pending'] },
                  notes:  { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Status updated' },
          400: { description: 'Invalid status value' },
          403: { description: 'Discipline mismatch or not a reviewer' },
          404: { description: 'Simulation not found' },
        },
      },
    },

    // ── Admin Simulations ────────────────────────────────────
    '/admin/simulations': {
      get: {
        tags: ['Admin – Simulations'],
        summary: 'List all simulations',
        responses: {
          200: { description: 'Array of simulations' },
          403: { description: 'Not an admin' },
        },
      },
      post: {
        tags: ['Admin – Simulations'],
        summary: 'Create a simulation',
        responses: {
          201: { description: 'Created' },
          403: { description: 'Not an admin' },
        },
      },
    },
    '/admin/simulations/{slug}': {
      get: {
        tags: ['Admin – Simulations'],
        summary: 'Get a simulation by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Simulation object' },
          404: { description: 'Not found' },
        },
      },
      put: {
        tags: ['Admin – Simulations'],
        summary: 'Update a simulation',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Updated' },
          403: { description: 'Not an admin' },
        },
      },
      delete: {
        tags: ['Admin – Simulations'],
        summary: 'Delete a simulation',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted' },
          403: { description: 'Not an admin' },
        },
      },
    },
  },
}
