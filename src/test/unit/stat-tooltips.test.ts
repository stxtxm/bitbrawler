import { describe, it, expect } from 'vitest';
import { STAT_TOOLTIPS, StatKey } from '../../utils/statUtils';

describe('STAT_TOOLTIPS', () => {
  const expectedTooltipText = '(No maximum limit)';
  
  it('all stat tooltips contain "No maximum limit" clarification', () => {
    Object.entries(STAT_TOOLTIPS).forEach(([, tooltip]) => {
      expect(tooltip).toContain(expectedTooltipText);
    });
  });

  it('each stat tooltip has meaningful description beyond the limit clarification', () => {
    Object.entries(STAT_TOOLTIPS).forEach(([, tooltip]) => {
      expect(tooltip.length).toBeGreaterThan(expectedTooltipText.length);
      expect(tooltip).not.toEqual(expectedTooltipText);
    });
  });

  it('all stat keys are covered in tooltips', () => {
    const expectedKeys: StatKey[] = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'];
    const actualKeys = Object.keys(STAT_TOOLTIPS) as StatKey[];
    
    expect(actualKeys).toHaveLength(expectedKeys.length);
    expectedKeys.forEach(key => {
      expect(actualKeys).toContain(key);
    });
  });

  it('tooltips are properly formatted strings', () => {
    Object.values(STAT_TOOLTIPS).forEach(tooltip => {
      expect(typeof tooltip).toBe('string');
      expect(tooltip.trim().length).toBeGreaterThan(0);
    });
  });
});