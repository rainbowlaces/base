# @embedMap Implementation Plan

## Overview
Implementing a new `@embedMap` decorator for storing embedded models as a keyed map (JSON object in DB, JavaScript Map in code).

## Architecture Understanding
- Decorators follow "Attach and Collect" pattern
- Use `@field` decorator internally to attach metadata
- Function-like accessors (getter returns function, setter throws)
- Metadata stored with `FIELD_METADATA_SYMBOL`
- Async operations for hydration/serialization
- Types defined as callable interfaces (no args = getter, with args = setter)

## Tasks

### 1. Add `EmbedMap<T>` type interface to `types.ts`
- Location: `packages/base/src/core/models/types.ts`
- Add after `EmbedMany` interface (line ~196)
- Signature: `(): Promise<Map<string, T>>` and `(value: MaybeAsync<Map<string, T>>): Promise<void>`

### 2. Add `structure` field to `FieldMetadata.relation` in `types.ts`
- Location: Same file, around line 95 (FieldMetadata interface)
- Add optional `structure?: 'array' | 'map'` to relation object
- This distinguishes array-based collections from map-based collections
- **Critical**: Existing `@embed` will have `undefined` structure (defaults to array)

### 3. Update `ModelData<T>` type to handle `EmbedMap`
- Location: Same file, around line 210
- Add case: `T[P] extends EmbedMap<infer U> ? Record<string, ModelData<U>>`
- This ensures proper type inference for serialization

### 4. Create `embedMap.ts` decorator implementation
- Location: `packages/base/src/core/models/decorators/embedMap.ts`
- Copy structure from `embed.ts`
- Key differences:
  - Single overload (no cardinality parameter in signature)
  - Metadata: Set `cardinality: 'many'` AND `structure: 'map'`
  - Serialize: `Map<string, T>` → `Record<string, ModelData<T>>`
  - Deserialize: `Record<string, ModelData<T>>` → `Map<string, T>`
  - Use `Object.entries()` and `Object.fromEntries()` for conversion
  - Handle `undefined`/`null` as empty map (`{}`)
- Metadata structure:
  ```typescript
  relation: { 
    type: 'embed', 
    model,
    cardinality: 'many',  // Satisfies existing checks
    structure: 'map'      // The real discriminator
  }
  ```

### 5. Modify `BaseModel.hydrate` to handle map structure
- Location: `packages/base/src/core/models/baseModel.ts`
- Around line 245 in the `hydrate` method
- Add logic to detect `structure === 'map'`
- When hydrating maps:
  - Expect `rawValue` to be plain object `Record<string, unknown>`
  - Iterate with `Object.entries()`
  - Call `await Model.fromData(value)` for each entry
  - Build and return `Map<string, T>`
- Preserve existing array logic when `structure` is `undefined` or `'array'`
- Pattern:
  ```typescript
  const isMany = relation.cardinality === 'many';
  const isMap = isMany && relation.structure === 'map';
  const isArray = isMany && (!relation.structure || relation.structure === 'array');
  ```

### 6. Export `embedMap` from main index
- Location: `packages/base/src/index.ts`
- Add after `embed` export (line ~83)
- Export `EmbedMap` type as well

### 7. Create comprehensive tests
- Location: `packages/base/test/core/models/decorators/embedMap.test.ts`
- Test cases:
  - Function-like accessor creation
  - Setting a Map and retrieving it
  - Serialization (Map → plain object)
  - Deserialization (plain object → Map with hydrated models)
  - Empty map handling
  - Field options (readOnly, default)
  - Direct assignment throws error
  - Integration with BaseModel methods (serialize, fromData)
  - Metadata is correctly attached

### 8. Run all tests and verify
- Use `pnpm test` to run full suite
- Fix any type errors or issues
- Ensure no regressions

## Answers to Questions
1. **Undefined handling**: YES. Support `undefined`/`null` as empty map. Store as `{}`. Follow `@embed` pattern.
2. **Key types**: STRING ONLY. `Map<string, T>`. JSON coerces numbers to strings anyway. Be honest.
3. **Key ordering**: NO GUARANTEES. Maps preserve insertion order, but JSON spec doesn't. Don't promise what we can't deliver.
4. **Helper methods**: NO. `appendTo` exists for cheap list operations. For maps, use `.set()`. No magic needed.
5. **Special metadata**: YES. `structure: 'map'` in `FieldMetadata.relation`. This is THE critical piece.

## Implementation Notes
- **NO changes to existing `@embed` decorator**
- `ModelRelationKeys` does NOT need updating (we're not adding `appendToMap`)
- Only core change is `BaseModel.hydrate` to read `structure` flag
- Backward compatible: `structure: undefined` defaults to array behavior
