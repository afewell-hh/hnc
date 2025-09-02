/**
 * UI Component tests for Issues Panel with Import Conflict Resolution - WP-IMP2
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IssuesPanel } from './IssuesPanel';
import type { Issue, FieldOverride } from '../app.types';
import type { ImportConflict } from '../domain/import-conflict-resolver';

// Mock data
const mockIssues: Issue[] = [
  {
    id: 'issue-1',
    type: 'error',
    severity: 'high',
    title: 'Configuration Error',
    message: 'Required field is missing',
    category: 'validation',
    field: 'name',
    overridable: false,
    overridden: false
  },
  {
    id: 'issue-2',
    type: 'warning',
    severity: 'medium',
    title: 'Configuration Warning',
    message: 'Suboptimal configuration detected',
    category: 'optimization',
    field: 'uplinksPerLeaf',
    overridable: true,
    overridden: false
  }
];

const mockImportConflicts: ImportConflict[] = [
  {
    id: 'import-conflict-1',
    type: 'warning',
    severity: 'medium',
    title: 'Spine Model Mismatch',
    message: 'Imported spine model differs from current configuration',
    category: 'import-conflict',
    field: 'spineModelId',
    overridable: true,
    overridden: false,
    importMetadata: {
      importedValue: 'DS3000',
      computedValue: 'DS4000',
      fieldPath: 'spineModelId',
      conflictType: 'model',
      provenance: {
        imported: 'import',
        computed: 'user'
      },
      confidence: 'high'
    },
    resolutionActions: [
      {
        type: 'accept',
        label: 'Use Imported Model',
        description: 'Switch to imported spine model',
        newProvenance: 'import',
        affectedFields: ['spinesNeeded', 'totalPorts']
      },
      {
        type: 'reject',
        label: 'Keep Current Model',
        description: 'Keep currently configured spine model',
        newProvenance: 'user',
        affectedFields: []
      }
    ]
  },
  {
    id: 'import-conflict-2',
    type: 'error',
    severity: 'high',
    title: 'Constraint Violation',
    message: 'Imported uplinks count violates even distribution requirement',
    category: 'import-conflict',
    field: 'uplinksPerLeaf',
    overridable: true,
    overridden: false,
    importMetadata: {
      importedValue: 3,
      computedValue: 4,
      fieldPath: 'uplinksPerLeaf',
      conflictType: 'constraint',
      provenance: {
        imported: 'import',
        computed: 'auto'
      },
      confidence: 'high'
    },
    resolutionActions: [
      {
        type: 'accept',
        label: 'Accept Import (Override Constraint)',
        description: 'Use imported value despite constraint violation',
        newProvenance: 'import',
        affectedFields: ['spinesNeeded', 'oversubscriptionRatio']
      },
      {
        type: 'modify',
        label: 'Round Up to Even',
        description: 'Increase to 4 to satisfy constraint',
        newValue: 4,
        newProvenance: 'user',
        affectedFields: ['spinesNeeded', 'oversubscriptionRatio']
      }
    ]
  }
];

const mockResolvedConflict: ImportConflict = {
  ...mockImportConflicts[0],
  overridden: true,
  message: 'Imported spine model differs from current configuration [RESOLVED: ACCEPT]'
};

describe('IssuesPanel with Import Conflicts', () => {
  let mockOnOverrideIssue: ReturnType<typeof vi.fn>;
  let mockOnClearOverride: ReturnType<typeof vi.fn>;
  let mockOnResolveImportConflict: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOverrideIssue = vi.fn();
    mockOnClearOverride = vi.fn();
    mockOnResolveImportConflict = vi.fn();
  });

  describe('Import Conflicts Display', () => {
    it('should show import conflicts section when conflicts exist', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={mockImportConflicts}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText(/Import Conflicts \(2 unresolved\)/)).toBeInTheDocument();
      expect(screen.getByText('Spine Model Mismatch')).toBeInTheDocument();
      expect(screen.getByText('Constraint Violation')).toBeInTheDocument();
    });

    it('should show unresolved conflict count correctly', () => {
      const mixedConflicts = [mockImportConflicts[0], mockResolvedConflict];
      
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={mixedConflicts}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // Should show 1 unresolved out of 2 total
      expect(screen.getByText(/Import Conflicts \(1 unresolved\)/)).toBeInTheDocument();
    });

    it('should show conflict type badges', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={mockImportConflicts}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText('MODEL')).toBeInTheDocument();
      expect(screen.getByText('CONSTRAINT')).toBeInTheDocument();
    });

    it('should show confidence badges', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={mockImportConflicts}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      const confidenceBadges = screen.getAllByText('high confidence');
      expect(confidenceBadges).toHaveLength(2);
    });

    it('should display value comparison', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={mockImportConflicts}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // Should show imported and current values
      expect(screen.getByText('Imported:')).toBeInTheDocument();
      expect(screen.getByText('Current:')).toBeInTheDocument();
      expect(screen.getByText('"DS3000"')).toBeInTheDocument();
      expect(screen.getByText('"DS4000"')).toBeInTheDocument();
    });
  });

  describe('Resolution Actions', () => {
    it('should display resolution actions for each conflict', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[0]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText('Use Imported Model')).toBeInTheDocument();
      expect(screen.getByText('Keep Current Model')).toBeInTheDocument();
    });

    it('should enable resolve button when action is selected', async () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[0]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      const resolveButton = screen.getByText('Resolve Conflict');
      expect(resolveButton).toBeDisabled();

      // Select an action
      const acceptRadio = screen.getByLabelText(/Use Imported Model/);
      fireEvent.click(acceptRadio);

      await waitFor(() => {
        expect(resolveButton).toBeEnabled();
      });
    });

    it('should call onResolveImportConflict when resolve button is clicked', async () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[0]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // Select accept action
      const acceptRadio = screen.getByLabelText(/Use Imported Model/);
      fireEvent.click(acceptRadio);

      // Click resolve button
      const resolveButton = screen.getByText('Resolve Conflict');
      fireEvent.click(resolveButton);

      await waitFor(() => {
        expect(mockOnResolveImportConflict).toHaveBeenCalledWith(
          'import-conflict-1',
          'accept',
          undefined
        );
      });
    });

    it('should show modify input when modify action is selected', async () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[1]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // Select modify action
      const modifyRadio = screen.getByLabelText(/Round Up to Even/);
      fireEvent.click(modifyRadio);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter new value...')).toBeInTheDocument();
      });
    });

    it('should require modify value before enabling resolve button', async () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[1]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      const resolveButton = screen.getByText('Resolve Conflict');
      
      // Select modify action
      const modifyRadio = screen.getByLabelText(/Round Up to Even/);
      fireEvent.click(modifyRadio);

      // Resolve button should still be disabled without modify value
      await waitFor(() => {
        expect(resolveButton).toBeDisabled();
      });

      // Enter modify value
      const modifyInput = screen.getByPlaceholderText('Enter new value...');
      fireEvent.change(modifyInput, { target: { value: '6' } });

      // Now resolve button should be enabled
      await waitFor(() => {
        expect(resolveButton).toBeEnabled();
      });
    });

    it('should call onResolveImportConflict with modify value', async () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[1]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // Select modify action and enter value
      const modifyRadio = screen.getByLabelText(/Round Up to Even/);
      fireEvent.click(modifyRadio);

      const modifyInput = screen.getByPlaceholderText('Enter new value...');
      fireEvent.change(modifyInput, { target: { value: '6' } });

      // Click resolve button
      const resolveButton = screen.getByText('Resolve Conflict');
      fireEvent.click(resolveButton);

      await waitFor(() => {
        expect(mockOnResolveImportConflict).toHaveBeenCalledWith(
          'import-conflict-2',
          'modify',
          '6'
        );
      });
    });

    it('should show affected fields for resolution actions', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[0]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText(/Will affect: spinesNeeded, totalPorts/)).toBeInTheDocument();
    });
  });

  describe('Resolved Conflicts Display', () => {
    it('should display resolved conflicts with resolved state', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockResolvedConflict]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText('RESOLVED')).toBeInTheDocument();
      expect(screen.getByText(/RESOLVED: ACCEPT/)).toBeInTheDocument();
    });

    it('should not show resolution actions for resolved conflicts', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockResolvedConflict]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.queryByText('Choose Resolution:')).not.toBeInTheDocument();
      expect(screen.queryByText('Resolve Conflict')).not.toBeInTheDocument();
    });
  });

  describe('Combined Issues and Import Conflicts', () => {
    it('should display both regular issues and import conflicts', () => {
      render(
        <IssuesPanel
          issues={mockIssues}
          importConflicts={mockImportConflicts}
          onOverrideIssue={mockOnOverrideIssue}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // Should show both issues and import conflicts
      expect(screen.getByText('Configuration Error')).toBeInTheDocument();
      expect(screen.getByText('Configuration Warning')).toBeInTheDocument();
      expect(screen.getByText('Spine Model Mismatch')).toBeInTheDocument();
      expect(screen.getByText('Constraint Violation')).toBeInTheDocument();
    });

    it('should show correct counts in summary', () => {
      render(
        <IssuesPanel
          issues={mockIssues}
          importConflicts={mockImportConflicts}
          onOverrideIssue={mockOnOverrideIssue}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      // 2 issues + 2 import conflicts = 4 total items
      expect(screen.getByText('Issues (2)')).toBeInTheDocument();
      expect(screen.getByText(/Import Conflicts \(2 unresolved\)/)).toBeInTheDocument();
      expect(screen.getByText('2/2 Import Conflicts')).toBeInTheDocument();
    });

    it('should show import resolved chip for resolved import conflicts in issues list', () => {
      const issueFromImportConflict: Issue = {
        ...mockResolvedConflict,
        category: 'import-conflict'
      };

      render(
        <IssuesPanel
          issues={[issueFromImportConflict]}
          importConflicts={[]}
          onOverrideIssue={mockOnOverrideIssue}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText('IMPORT RESOLVED')).toBeInTheDocument();
    });
  });

  describe('No Issues State', () => {
    it('should show all clear message when no issues or conflicts exist', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByText('All Clear')).toBeInTheDocument();
      expect(screen.getByText('No validation issues detected. Configuration is ready for deployment.')).toBeInTheDocument();
    });

    it('should not show all clear when import conflicts exist', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={mockImportConflicts}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.queryByText('All Clear')).not.toBeInTheDocument();
    });
  });

  describe('Test IDs and Accessibility', () => {
    it('should have proper test IDs for import conflicts', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[0]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      expect(screen.getByTestId('import-conflict-import-conflict-1')).toBeInTheDocument();
      expect(screen.getByTestId('resolve-conflict-import-conflict-1')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(
        <IssuesPanel
          issues={[]}
          importConflicts={[mockImportConflicts[0]]}
          onResolveImportConflict={mockOnResolveImportConflict}
        />
      );

      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons).toHaveLength(2); // Two resolution actions

      const resolveButton = screen.getByRole('button', { name: /Resolve Conflict/ });
      expect(resolveButton).toBeInTheDocument();
    });
  });
});