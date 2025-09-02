/**
 * useStepValidation Hook - WP-NAV1
 * State management for step validation across tabbed navigation
 */

import { useState, useCallback, useMemo } from 'react'
import { ValidationBadge, ValidationIssue, getBadgeForIssues } from '../components/gfd/StatusBadge'
import { StepValidation } from '../components/gfd/StepTab'

export interface StepValidationState {
  [stepId: string]: StepValidation
}

export interface NavigationRules {
  allowForwardNavigation: boolean
  blockSaveOnErrors: boolean
  preserveValidationState: boolean
  showPreviewInFutureSteps: boolean
}

export interface UseStepValidationOptions {
  initialValidations?: StepValidationState
  navigationRules?: Partial<NavigationRules>
}

const DEFAULT_NAVIGATION_RULES: NavigationRules = {
  allowForwardNavigation: true,
  blockSaveOnErrors: true,
  preserveValidationState: true,
  showPreviewInFutureSteps: true
}

export const useStepValidation = (
  stepIds: string[],
  options: UseStepValidationOptions = {}
) => {
  const navigationRules = { ...DEFAULT_NAVIGATION_RULES, ...options.navigationRules }
  
  // Initialize validation state for all steps
  const initialState = useMemo(() => {
    const state: StepValidationState = {}
    stepIds.forEach(stepId => {
      state[stepId] = options.initialValidations?.[stepId] || {
        stepId,
        badge: 'pending' as ValidationBadge,
        issues: [],
        hasChanged: false
      }
    })
    return state
  }, [stepIds, options.initialValidations])

  const [validationState, setValidationState] = useState<StepValidationState>(initialState)

  // Update validation for a specific step
  const updateStepValidation = useCallback((
    stepId: string, 
    issues: ValidationIssue[], 
    hasChanged: boolean = true
  ) => {
    const badge = getBadgeForIssues(issues)
    
    setValidationState(prev => ({
      ...prev,
      [stepId]: {
        stepId,
        badge,
        issues,
        hasChanged
      }
    }))
  }, [])

  // Clear validation for a step
  const clearStepValidation = useCallback((stepId: string) => {
    setValidationState(prev => ({
      ...prev,
      [stepId]: {
        stepId,
        badge: 'pending' as ValidationBadge,
        issues: [],
        hasChanged: false
      }
    }))
  }, [])

  // Set loading state for a step
  const setStepLoading = useCallback((stepId: string, loading: boolean) => {
    setValidationState(prev => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        badge: loading ? 'loading' : prev[stepId].badge
      }
    }))
  }, [])

  // Check if any step has errors
  const hasErrors = useMemo(() => {
    return Object.values(validationState).some(step => step.badge === 'error')
  }, [validationState])

  // Check if any step has warnings
  const hasWarnings = useMemo(() => {
    return Object.values(validationState).some(step => step.badge === 'warning')
  }, [validationState])

  // Check if save should be blocked
  const saveBlocked = useMemo(() => {
    return navigationRules.blockSaveOnErrors && hasErrors
  }, [navigationRules.blockSaveOnErrors, hasErrors])

  // Get all error issues across steps
  const allErrors = useMemo(() => {
    return Object.values(validationState)
      .flatMap(step => step.issues)
      .filter(issue => issue.type === 'error')
  }, [validationState])

  // Get all warning issues across steps
  const allWarnings = useMemo(() => {
    return Object.values(validationState)
      .flatMap(step => step.issues)
      .filter(issue => issue.type === 'warning')
  }, [validationState])

  // Get validation summary for display
  const validationSummary = useMemo(() => {
    const errorSteps = Object.values(validationState).filter(s => s.badge === 'error')
    const warningSteps = Object.values(validationState).filter(s => s.badge === 'warning')
    const completedSteps = Object.values(validationState).filter(s => s.badge === 'ok')
    const pendingSteps = Object.values(validationState).filter(s => s.badge === 'pending')

    return {
      totalSteps: stepIds.length,
      errorSteps: errorSteps.length,
      warningSteps: warningSteps.length,
      completedSteps: completedSteps.length,
      pendingSteps: pendingSteps.length,
      overallStatus: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok' as ValidationBadge
    }
  }, [validationState, stepIds.length, hasErrors, hasWarnings])

  // Batch update multiple steps
  const batchUpdateValidations = useCallback((
    updates: Array<{
      stepId: string
      issues: ValidationIssue[]
      hasChanged?: boolean
    }>
  ) => {
    setValidationState(prev => {
      const newState = { ...prev }
      
      updates.forEach(({ stepId, issues, hasChanged = true }) => {
        const badge = getBadgeForIssues(issues)
        newState[stepId] = {
          stepId,
          badge,
          issues,
          hasChanged
        }
      })
      
      return newState
    })
  }, [])

  // Reset all validations
  const resetValidations = useCallback(() => {
    setValidationState(initialState)
  }, [initialState])

  return {
    validationState,
    navigationRules,
    updateStepValidation,
    clearStepValidation,
    setStepLoading,
    batchUpdateValidations,
    resetValidations,
    hasErrors,
    hasWarnings,
    saveBlocked,
    allErrors,
    allWarnings,
    validationSummary
  }
}

export default useStepValidation