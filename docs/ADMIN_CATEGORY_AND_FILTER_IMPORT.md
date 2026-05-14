# Admin: category tree API & Excel imports

Stack: **Node.js + Express + MongoDB (Mongoose)**.

## 1) Nested category tree (filters UI)

**`GET /api/admin/categories/nested-for-filters`** (auth: admin)

Returns one DB query of all non-deleted categories, built into a nested structure for cascading dropdowns.

### Response shape

```json
{
  "categories": [
    {
      "id": "64a...",
      "name": "Electronics",
      "slug": "electronics",
      "level": 0,
      "parentId": null,
      "subcategories": [
        {
          "id": "64b...",
          "name": "Mobiles",
          "slug": "mobiles",
          "level": 1,
          "parentId": "64a...",
          "children": [
            {
              "id": "64c...",
              "name": "Smartphones",
              "slug": "smartphones",
              "level": 2,
              "parentId": "64b...",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

- **Roots** live in `categories[]`.
- **First level under a root** uses the key **`subcategories`**.
- **Deeper levels** use **`children`** recursively.

## 2) Filters Excel import

**`POST /api/admin/filters/import`** or **`POST /api/admin/filters/import-excel`**  
Content-Type: `multipart/form-data`

| Field        | Required | Description |
|-------------|----------|-------------|
| `file`      | Yes      | `.xlsx` / `.xls` / `.csv` |
| `categoryId`| No       | If set, imported filters are linked to this category via `category_filters` (and subtree scoping in the UI uses this category). |

### Sheet layout

- Prefer a sheet named **`Filters`**, otherwise the first sheet is used.
- **Row 1** = header (ignored).
- **Column A** = parent filter group name (root filter).
- **Column B** = property names (comma-separated allowed).

### Sample (CSV)

```csv
Filter Group,Properties
Color,"Red, Blue, Green"
Fuel,"Petrol, Diesel, Electric"
```

### Success response (summary)

```json
{
  "message": "Imported filters successfully",
  "total": 100,
  "success": 92,
  "failed": 8,
  "errors": [
    { "row": 5, "message": "Column B (properties) is required — use comma-separated values" }
  ],
  "totalFiltersCreated": 3,
  "totalPropertiesAdded": 120,
  "skippedDuplicates": 15,
  "assignCategoryId": "64a..." 
}
```

## 3) Categories Excel import (Brand / Model / Variant)

**`POST /api/admin/categories/import-excel`**  
Content-Type: `multipart/form-data`

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | Excel file |
| `targetCategoryId` | No | **Recommended:** import Brand/Model/Variant **under this category** (any level). If set, `rootCategoryId` / `subCategoryId` are ignored. |
| `rootCategoryId` | No | Root category id (legacy) |
| `subCategoryId` | No | Child of root (legacy) |
| `rootCategoryName` | No | Defaults to `"Motors"` if no `rootCategoryId` |

### Response (summary)

```json
{
  "message": "Imported categories from New Cars",
  "total": 50,
  "success": 48,
  "failed": 2,
  "errors": [{ "row": 12, "message": "Brand (column A) is required when Model or Variant is provided" }],
  "sheetName": "New Cars",
  "anchorCategoryId": "64a..."
}
```

## 4) Fixes included

- **Filter import:** `CategoryFilter` lookup for child filters uses `$and: [{ $or: pairs }, { isDeleted... }]` (correct Mongo semantics).
- **Row validation** for filters import with per-row `errors[]` and `success` / `failed` counts.
- **Uploaded temp file** deleted after successful processing (filters + categories import services).
