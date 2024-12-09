# Migration Notes

## Weight System Simplification (January 2024)

### Changes Made
1. Simplified weight system from complex thresholds to 0-3 scale:
   - Level 0 (Minimal) = threshold 3 (most restrictive)
   - Level 1 (Moderate) = threshold 2
   - Level 2 (Extensive) = threshold 1
   - Level 3 (Complete) = threshold 0 (most inclusive)

2. Removed targetKeywordCount:
   - Removed from state
   - Removed setTargetKeywordCount function
   - Updated state persistence
   - Simplified filterLevel handling

3. Removed category weights:
   - Weight thresholds now based only on keyword weights
   - Simplified filtering logic
   - Maintained case sensitivity handling

### Future Considerations
1. Categories will be removed in a future update
2. Current category-related code is maintained for backwards compatibility
3. New features should use filterLevel and keyword weights only

### Migration Path
- Old state using targetKeywordCount will default to filterLevel 0
- Existing keyword weights (0-3) work directly with new thresholds
- Category weights are ignored but preserved in data structure for now
