# Keyword Weighting System Migration

## Current System

The current system uses weights 1-10 for both categories and keywords, with higher numbers being more significant.

### Category Weights
- 9-10: Most significant categories (e.g., Economic Policy, Education)
- 7-8: Important categories (e.g., Climate and Environment, Healthcare)
- 5-6: Extended coverage categories
- 1-4: Basic coverage categories

### Keyword Weights
- 7-8: Highly frequent/significant terms
- 5-6: Common/regular terms
- 3-4: Occasional/moderate terms
- 1-2: Rare/basic terms

### Distribution Levels
The system currently has four distribution levels with actual keyword counts:
- Minimal: 190 highest weighted keywords
- Moderate: 413 keywords
- Extensive: 815 keywords
- Complete: All remaining keywords (~2000+ total keywords)

## Weight Threshold Algorithm

The current algorithm in weightManager.js determines which keywords to include based on both category and keyword weights:

```javascript
case 190:  // Minimal
    return categoryWeight >= 9 ? 8 :  // For highest categories (9), include keywords weighted 8+
           categoryWeight >= 8 ? 9 :  // For high categories (8), only include keywords weighted 9
           11;                        // For others, exclude all

case 413:  // Moderate
    return categoryWeight >= 9 ? 7 :  // For highest categories, include keywords weighted 7+
           categoryWeight >= 8 ? 8 :  // For high categories, include keywords weighted 8+
           9;                         // For others, only highest weighted keywords

case 815:  // Extensive
    return categoryWeight >= 9 ? 6 :  // For highest categories, include keywords weighted 6+
           categoryWeight >= 8 ? 7 :  // For high categories, include keywords weighted 7+
           8;                         // For others, include keywords weighted 8+
```

## New Scale (0-3)

The new scale inverts the power relationship, with 0 being least significant and 3 being most significant. This aligns with common programming practices where array indices and enums typically start at 0.

### Category Weights
- 3: Most significant categories (previously 9-10)
- 2: Important categories (previously 7-8)
- 1: Extended coverage categories (previously 5-6)
- 0: Basic coverage categories (previously 1-4)

### Keyword Weights
- 3: Highly frequent/significant terms (previously 7-8)
- 2: Common/regular terms (previously 5-6)
- 1: Occasional/moderate terms (previously 3-4)
- 0: Rare/basic terms (previously 1-2)

### Distribution Levels
The distribution levels remain the same but with inverted significance:
- Level 0 (Complete): All keywords (~2000+)
- Level 1 (Extensive): 815 keywords
- Level 2 (Moderate): 413 keywords
- Level 3 (Minimal): 190 keywords

### Keyword Distribution

The actual distribution of keywords across levels:
- Level 3 (Minimal): Top 190 keywords from highest weighted categories
  * Category weight 3: Keywords weighted 3
  * Category weight 2: Keywords weighted 3
  * Others: None included
- Level 2 (Moderate): 413 keywords
  * Category weight 3: Keywords weighted 2-3
  * Category weight 2: Keywords weighted 3
  * Others: Keywords weighted 3 only
- Level 1 (Extensive): 815 keywords
  * Category weight 3: Keywords weighted 1-3
  * Category weight 2: Keywords weighted 2-3
  * Others: Keywords weighted 3
- Level 0 (Complete): All 2000+ keywords included

### Examples

#### Economic Policy (Category Weight 3, previously 9)
- "recession" (Weight 3, previously 9): Highly frequent economic term
- "debt ceiling" (Weight 3, previously 8): Highly frequent policy crisis
- "banking crisis" (Weight 2, previously 7): Frequent financial term
- "tax cut" (Weight 1, previously 6): Common policy term
- "capital gains" (Weight 0, previously 4): Technical tax term

#### Climate and Environment (Category Weight 2, previously 8)
- "climate change" (Weight 3, previously 9): Highly frequent environmental term
- "extreme heat" (Weight 3, previously 8): Frequent weather crisis term
- "drought" (Weight 2, previously 7): Frequent weather crisis term
- "carbon footprint" (Weight 1, previously 5): Regular environmental impact term
- "desertification" (Weight 0, previously 4): Occasional environmental term

## Migration Benefits

1. **Intuitive Scaling**: 0-3 provides a clearer, more concise range compared to 1-10
2. **Programming Alignment**: Starts at 0, matching common programming patterns
3. **Simplified Logic**: Four distinct levels make the weighting system more straightforward
4. **Maintained Relationships**: Preserves the existing keyword distribution and category importance while using a cleaner scale

## Implementation Steps

1. **Update Category Files**
   - Convert category weights:
     * 9-10 → 3
     * 7-8 → 2
     * 5-6 → 1
     * 1-4 → 0
   - Convert keyword weights:
     * 8-10 → 3
     * 7-6 → 2
     * 3-4 → 1
     * 1-2 → 0

2. **Update weightManager.js**
   ```javascript
   case 190:  // Level 3 (Minimal)
       return categoryWeight === 3 ? 3 :  // For highest categories, include keywords weighted 3
              categoryWeight === 2 ? 3 :  // For high categories, include keywords weighted 3
              4;                         // For others, exclude all

   case 413:  // Level 2 (Moderate)
       return categoryWeight === 3 ? 2 :  // For highest categories, include keywords weighted 2+
              categoryWeight === 2 ? 3 :  // For high categories, include keywords weighted 3
              3;                         // For others, only highest weighted keywords

   case 815:  // Level 1 (Extensive)
       return categoryWeight === 3 ? 1 :  // For highest categories, include keywords weighted 1+
              categoryWeight === 2 ? 2 :  // For high categories, include keywords weighted 2+
              3;                         // For others, include keywords weighted 3
   ```

3. **Update UI Components**
   - Modify any UI elements that display weight values
   - Update any sorting logic that depends on weights
   - Ensure filtering mechanisms reflect the new scale

4. **Update Tests**
   - Modify test cases to use new weight values
   - Update expected results in keyword filtering tests
   - Add migration-specific tests to verify correct weight conversion

5. **Documentation Updates**
   - Update API documentation
   - Update user guides
   - Add migration notes for developers

## Migration Safety

### Validation Steps
1. **Pre-migration Validation**
   - Count total keywords at each level
   - Generate distribution report for each category
   - Verify current keyword inclusion patterns

2. **Post-migration Validation**
   - Verify total keyword counts match pre-migration
   - Confirm keyword inclusion patterns are preserved
   - Check category distribution matches expected patterns
   - Validate that Level 3 (Minimal) still contains the same 190 most significant keywords

### Rollback Procedure
1. Don't worry about it, we use source control.