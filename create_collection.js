const API_BASE_URL = 'http://goatedcodoer:8090';
const STATIC_TOKEN = 'NA9FAMvBr45KWDsu_YRuT77vNpGyGNZi';

const payload = {
  "collection": "company_memos",
  "meta": {
    "icon": "note",
    "note": "Company Memos"
  },
  "schema": {
    "name": "company_memos"
  },
  "fields": [
    {
      "field": "id",
      "type": "integer",
      "schema": { "is_primary_key": true, "has_auto_increment": true }
    },
    {
      "field": "title",
      "type": "string"
    },
    {
      "field": "content",
      "type": "text"
    },
    {
      "field": "attachment",
      "type": "string"
    },
    {
      "field": "status",
      "type": "string",
      "schema": { "default_value": "DRAFT" }
    },
    {
      "field": "priority",
      "type": "string",
      "schema": { "default_value": "NORMAL" }
    },
    {
      "field": "published_at",
      "type": "timestamp"
    },
    {
      "field": "created_at",
      "type": "timestamp",
      "meta": { "special": ["date-created"] }
    },
    {
      "field": "created_by",
      "type": "integer"
    },
    {
      "field": "updated_at",
      "type": "timestamp",
      "meta": { "special": ["date-updated"] }
    },
    {
      "field": "updated_by",
      "type": "integer"
    }
  ]
};

async function run() {
    try {
        console.log("Creating collection...");
        const res = await fetch(`${API_BASE_URL}/collections`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STATIC_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));

        // Create the foreign key relations
        console.log("Creating relations...");
        const relation1 = {
            collection: "company_memos",
            field: "created_by",
            related_collection: "user",
            schema: {
                constraint: "fk_memo_created_by",
                table: "company_memos",
                column: "created_by",
                foreign_key_table: "user",
                foreign_key_column: "user_id",
                on_delete: "SET NULL",
                on_update: "CASCADE"
            }
        };

        const relRes1 = await fetch(`${API_BASE_URL}/relations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STATIC_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(relation1)
        });
        console.log("Relation created_by:", await relRes1.json());

        const relation2 = {
            collection: "company_memos",
            field: "updated_by",
            related_collection: "user",
            schema: {
                constraint: "fk_memo_updated_by",
                table: "company_memos",
                column: "updated_by",
                foreign_key_table: "user",
                foreign_key_column: "user_id",
                on_delete: "SET NULL",
                on_update: "CASCADE"
            }
        };

        const relRes2 = await fetch(`${API_BASE_URL}/relations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STATIC_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(relation2)
        });
        console.log("Relation updated_by:", await relRes2.json());

        // Update permissions for vertex role (which is the one running this)
        console.log("Updating permissions...");
        const vertexRoleId = 'b68e6f74-5700-4ad5-b143-4b1cee7c50fd';
        const perms = [
            { collection: "company_memos", role: vertexRoleId, action: "read", fields: ["*"] },
            { collection: "company_memos", role: vertexRoleId, action: "create", fields: ["*"] },
            { collection: "company_memos", role: vertexRoleId, action: "update", fields: ["*"] },
            { collection: "company_memos", role: vertexRoleId, action: "delete", fields: ["*"] }
        ];

        for (const p of perms) {
            const permRes = await fetch(`${API_BASE_URL}/permissions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${STATIC_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(p)
            });
            console.log("Permission response:", await permRes.json());
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
