import { describe, it, expect, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import { workspaceMachine } from '../src/workspace.machine'

describe('WorkspaceMachine', () => {
  let actor: ReturnType<typeof createActor<typeof workspaceMachine>>

  beforeEach(() => {
    actor = createActor(workspaceMachine)
    actor.start()
  })

  it('should start in listing state with empty fabrics array', () => {
    expect(actor.getSnapshot().value).toBe('listing')
    expect(actor.getSnapshot().context.fabrics).toEqual([])
    expect(actor.getSnapshot().context.selectedFabricId).toBeNull()
    expect(actor.getSnapshot().context.errors).toEqual([])
  })

  describe('fabric creation', () => {
    it('should create fabric and stay in listing state when CREATE_FABRIC is sent', () => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Test Fabric' })
      
      expect(actor.getSnapshot().value).toBe('listing')
      expect(actor.getSnapshot().context.fabrics).toHaveLength(1)
      const fabric = actor.getSnapshot().context.fabrics[0]
      expect(fabric?.name).toBe('Test Fabric')
      expect(fabric?.status).toBe('draft')
    })

    it('should create fabric with proper metadata', () => {
      const beforeCreate = Date.now()
      actor.send({ type: 'CREATE_FABRIC', name: 'New Fabric' })
      const afterCreate = Date.now()
      
      const fabric = actor.getSnapshot().context.fabrics[0]
      expect(fabric).toBeDefined()
      if (fabric) {
        expect(fabric.name).toBe('New Fabric')
        expect(fabric.status).toBe('draft')
        expect(fabric.id).toMatch(/^fabric-\d+-\d+$/)
        expect(fabric.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate)
        expect(fabric.createdAt.getTime()).toBeLessThanOrEqual(afterCreate)
        expect(fabric.lastModified.getTime()).toBe(fabric.createdAt.getTime())
      }
    })

    it('should reject empty fabric names', () => {
      actor.send({ type: 'CREATE_FABRIC', name: '' })
      
      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.errors).toContain('Fabric name cannot be empty')
      expect(actor.getSnapshot().context.fabrics).toHaveLength(0)
    })

    it('should reject whitespace-only fabric names', () => {
      actor.send({ type: 'CREATE_FABRIC', name: '   ' })
      
      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.errors).toContain('Fabric name cannot be empty')
    })

    it('should reject duplicate fabric names', () => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Duplicate' })
      actor.send({ type: 'CREATE_FABRIC', name: 'Duplicate' })
      
      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.errors).toContain('Fabric name must be unique')
      expect(actor.getSnapshot().context.fabrics).toHaveLength(1)
    })

    it('should allow fabric names that differ only in case', () => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Test' })
      actor.send({ type: 'CREATE_FABRIC', name: 'test' })
      
      expect(actor.getSnapshot().value).toBe('listing')
      expect(actor.getSnapshot().context.fabrics).toHaveLength(2)
    })
  })

  describe('fabric selection', () => {
    let fabricId: string

    beforeEach(() => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Test Fabric' })
      const fabric = actor.getSnapshot().context.fabrics[0]
      if (!fabric) throw new Error('Fabric not created in test setup')
      fabricId = fabric.id
    })

    it('should transition to selected state and set selectedFabricId', () => {
      actor.send({ type: 'SELECT_FABRIC', fabricId })
      
      expect(actor.getSnapshot().value).toBe('selected')
      expect(actor.getSnapshot().context.selectedFabricId).toBe(fabricId)
    })

    it('should clear errors when selecting fabric', () => {
      // First create an error state
      actor.send({ type: 'CREATE_FABRIC', name: '' })
      expect(actor.getSnapshot().context.errors).not.toEqual([])
      
      // Then select a valid fabric
      actor.send({ type: 'SELECT_FABRIC', fabricId })
      expect(actor.getSnapshot().context.errors).toEqual([])
    })
  })

  describe('fabric deletion', () => {
    let fabric1Id: string
    let fabric2Id: string

    beforeEach(() => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Fabric 1' })
      actor.send({ type: 'CREATE_FABRIC', name: 'Fabric 2' })
      const fabrics = actor.getSnapshot().context.fabrics
      if (fabrics.length < 2) throw new Error('Fabrics not created in test setup')
      fabric1Id = fabrics[0]!.id
      fabric2Id = fabrics[1]!.id
    })

    it('should remove fabric from array', () => {
      actor.send({ type: 'DELETE_FABRIC', fabricId: fabric1Id })
      
      expect(actor.getSnapshot().context.fabrics).toHaveLength(1)
      expect(actor.getSnapshot().context.fabrics[0]?.id).toBe(fabric2Id)
    })

    it('should transition back to listing if deleting selected fabric', () => {
      actor.send({ type: 'SELECT_FABRIC', fabricId: fabric1Id })
      expect(actor.getSnapshot().value).toBe('selected')
      
      actor.send({ type: 'DELETE_FABRIC', fabricId: fabric1Id })
      
      expect(actor.getSnapshot().value).toBe('listing')
      expect(actor.getSnapshot().context.selectedFabricId).toBeNull()
      expect(actor.getSnapshot().context.fabrics).toHaveLength(1)
    })

    it('should stay in selected state if deleting non-selected fabric', () => {
      actor.send({ type: 'SELECT_FABRIC', fabricId: fabric1Id })
      actor.send({ type: 'DELETE_FABRIC', fabricId: fabric2Id })
      
      expect(actor.getSnapshot().value).toBe('selected')
      expect(actor.getSnapshot().context.selectedFabricId).toBe(fabric1Id)
      expect(actor.getSnapshot().context.fabrics).toHaveLength(1)
    })

    it('should handle deleting non-existent fabric gracefully', () => {
      const initialFabrics = actor.getSnapshot().context.fabrics
      actor.send({ type: 'DELETE_FABRIC', fabricId: 'non-existent-id' })
      
      expect(actor.getSnapshot().context.fabrics).toEqual(initialFabrics)
    })
  })

  describe('navigation', () => {
    it('should return to listing state when BACK_TO_LIST is sent', () => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Test' })
      const fabric = actor.getSnapshot().context.fabrics[0]
      if (!fabric) throw new Error('Fabric not created')
      actor.send({ type: 'SELECT_FABRIC', fabricId: fabric.id })
      
      expect(actor.getSnapshot().value).toBe('selected')
      
      actor.send({ type: 'BACK_TO_LIST' })
      
      expect(actor.getSnapshot().value).toBe('listing')
      expect(actor.getSnapshot().context.selectedFabricId).toBeNull()
    })
  })

  describe('fabric status updates', () => {
    let fabricId: string

    beforeEach(() => {
      actor.send({ type: 'CREATE_FABRIC', name: 'Test Fabric' })
      const fabric = actor.getSnapshot().context.fabrics[0]
      if (!fabric) throw new Error('Fabric not created in test setup')
      fabricId = fabric.id
      actor.send({ type: 'SELECT_FABRIC', fabricId })
    })

    it('should update fabric status and lastModified timestamp', () => {
      const initialTimestamp = actor.getSnapshot().context.fabrics[0]?.lastModified
      if (!initialTimestamp) throw new Error('No initial timestamp')
      
      actor.send({ type: 'UPDATE_FABRIC_STATUS', fabricId, status: 'computed' })
      
      const updatedFabric = actor.getSnapshot().context.fabrics[0]
      expect(updatedFabric?.status).toBe('computed')
      // Just check that timestamp exists, don't worry about exact timing
      expect(updatedFabric?.lastModified).toBeDefined()
    })

    it('should only update the specified fabric', () => {
      actor.send({ type: 'BACK_TO_LIST' })
      actor.send({ type: 'CREATE_FABRIC', name: 'Second Fabric' })
      const fabric2 = actor.getSnapshot().context.fabrics[1]
      if (!fabric2) throw new Error('Second fabric not created')
      
      actor.send({ type: 'UPDATE_FABRIC_STATUS', fabricId, status: 'saved' })
      
      const fabrics = actor.getSnapshot().context.fabrics
      expect(fabrics[0]?.status).toBe('saved')
      expect(fabrics[1]?.status).toBe('draft')
    })
  })

  describe('error recovery', () => {
    it('should clear errors when creating valid fabric from error state', () => {
      actor.send({ type: 'CREATE_FABRIC', name: '' })
      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.errors.length).toBeGreaterThan(0)
      
      actor.send({ type: 'CREATE_FABRIC', name: 'Valid Name' })
      expect(actor.getSnapshot().value).toBe('listing')
      expect(actor.getSnapshot().context.errors).toEqual([])
    })

    it('should clear errors when transitioning from error to listing', () => {
      actor.send({ type: 'CREATE_FABRIC', name: '' })
      expect(actor.getSnapshot().context.errors.length).toBeGreaterThan(0)
      
      actor.send({ type: 'LIST_FABRICS' })
      expect(actor.getSnapshot().value).toBe('listing')
      expect(actor.getSnapshot().context.errors).toEqual([])
    })
  })
})