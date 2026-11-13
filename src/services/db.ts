import { Project, GenerationRecord, RoomType, GeometryPreservationMode } from '../types/project';

class DatabaseService {
  private inMemoryProjects: Project[] = [];
  private inMemoryGenerations: GenerationRecord[] = [];

  constructor() {
    this.loadFallbackData();
  }

  private loadFallbackData() {
    try {
      const p = localStorage.getItem('interior_ai_projects');
      if (p) this.inMemoryProjects = JSON.parse(p);
      const g = localStorage.getItem('interior_ai_generations');
      if (g) this.inMemoryGenerations = JSON.parse(g);
    } catch (e) {}
  }

  private saveFallbackData() {
    try {
      localStorage.setItem('interior_ai_projects', JSON.stringify(this.inMemoryProjects));
      localStorage.setItem('interior_ai_generations', JSON.stringify(this.inMemoryGenerations));
    } catch (e) {}
  }

  async getAllProjects(): Promise<Project[]> {
    if (window.electronAPI) {
      try {
        const rows = await window.electronAPI.dbQuery(
          `SELECT p.*,
            COALESCE(
              (SELECT NULLIF(g2.output_image_base64, '') FROM generations g2 WHERE g2.project_id = p.id ORDER BY g2.created_at DESC LIMIT 1),
              CASE WHEN LENGTH(p.thumbnail_path) > 1000 THEN p.thumbnail_path ELSE NULL END
            ) AS display_thumbnail_path,
            COUNT(g.id) as generations_count
           FROM projects p LEFT JOIN generations g ON p.id = g.project_id
           GROUP BY p.id ORDER BY p.updated_at DESC`
        );
        return rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          roomType: r.room_type as RoomType,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          thumbnailPath: r.display_thumbnail_path || '',
          sourceImagePath: r.source_image_path,
          sourceImageBase64: r.source_image_base64 || (r.views_json ? JSON.parse(r.views_json)?.[0]?.sourceImageBase64 : ''),
          materialReferences: r.material_references ? JSON.parse(r.material_references) : [],
          views: r.views_json ? JSON.parse(r.views_json) : [],
          approvedDesign: r.approved_design_json ? JSON.parse(r.approved_design_json) : undefined,
          designDraft: r.design_draft_json ? JSON.parse(r.design_draft_json) : undefined,
          designVariants: r.design_variants_json ? JSON.parse(r.design_variants_json) : [],
          generationsCount: r.generations_count || 0,
        }));
      } catch (e) {
        console.error('db:getAllProjects error, falling back:', e);
      }
    }
    return [...this.inMemoryProjects].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getProjectById(id: string): Promise<Project | null> {
    if (window.electronAPI) {
      try {
        const rows = await window.electronAPI.dbQuery(
          `SELECT p.*,
            COALESCE(
              (SELECT NULLIF(g.output_image_base64, '') FROM generations g WHERE g.project_id = p.id ORDER BY g.created_at DESC LIMIT 1),
              CASE WHEN LENGTH(p.thumbnail_path) > 1000 THEN p.thumbnail_path ELSE NULL END
            ) AS display_thumbnail_path
           FROM projects p WHERE p.id = ?`, [id]
        );
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            name: r.name,
            description: r.description,
            roomType: r.room_type,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            thumbnailPath: r.display_thumbnail_path || '',
            sourceImagePath: r.source_image_path,
            sourceImageBase64: r.source_image_base64 || (r.views_json ? JSON.parse(r.views_json)?.[0]?.sourceImageBase64 : ''),
            materialReferences: r.material_references ? JSON.parse(r.material_references) : [],
            views: r.views_json ? JSON.parse(r.views_json) : [],
            approvedDesign: r.approved_design_json ? JSON.parse(r.approved_design_json) : undefined,
            designDraft: r.design_draft_json ? JSON.parse(r.design_draft_json) : undefined,
            designVariants: r.design_variants_json ? JSON.parse(r.design_variants_json) : [],
          };
        }
      } catch (e) {
        console.error('db:getProjectById error:', e);
      }
    }
    return this.inMemoryProjects.find((p) => p.id === id) || null;
  }

  async saveProject(project: Project, requirePersistence = false): Promise<void> {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.dbExecute(
          `INSERT OR REPLACE INTO projects (id, name, description, room_type, created_at, updated_at, thumbnail_path, source_image_path, source_image_base64, material_references, views_json, approved_design_json, design_draft_json, design_variants_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project.id,
            project.name,
            project.description || '',
            project.roomType,
            project.createdAt,
            project.updatedAt,
            project.thumbnailPath || '',
            project.sourceImagePath || '',
            project.views?.length ? '' : (project.sourceImageBase64 || ''),
            JSON.stringify(project.materialReferences || []),
            JSON.stringify(project.views || []),
            project.approvedDesign ? JSON.stringify(project.approvedDesign) : null,
            project.designDraft ? JSON.stringify(project.designDraft) : null,
            JSON.stringify(project.designVariants || []),
          ]
        );
        if (!result.success) throw new Error(result.error);
        return;
      } catch (e) {
        console.error('db:saveProject error:', e);
        if (requirePersistence) throw e;
      }
    }

    const idx = this.inMemoryProjects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      this.inMemoryProjects[idx] = project;
    } else {
      this.inMemoryProjects.push(project);
    }
    this.saveFallbackData();
  }

  async deleteProject(id: string): Promise<void> {
    if (window.electronAPI) {
      try {
        await window.electronAPI.dbExecute('DELETE FROM projects WHERE id = ?', [id]);
        await window.electronAPI.dbExecute('DELETE FROM generations WHERE project_id = ?', [id]);
        return;
      } catch (e) {}
    }
    this.inMemoryProjects = this.inMemoryProjects.filter((p) => p.id !== id);
    this.inMemoryGenerations = this.inMemoryGenerations.filter((g) => g.projectId !== id);
    this.saveFallbackData();
  }

  async clearAllProjectData(): Promise<void> {
    if (window.electronAPI) {
      const result = await window.electronAPI.dbClearProjectData();
      if (!result.success) throw new Error(result.error || 'Unable to clear project data');
      localStorage.setItem('interior_ai_projects_cleared', 'true');
      return;
    }
    this.inMemoryProjects = [];
    this.inMemoryGenerations = [];
    this.saveFallbackData();
    localStorage.setItem('interior_ai_projects_cleared', 'true');
  }

  async saveGeneration(record: GenerationRecord, requirePersistence = false): Promise<void> {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.dbExecute(
          `INSERT INTO generations (
            id, project_id, parent_id, view_id, source_image_path, source_image_base64,
            output_image_path, output_image_base64, prompt, style_id, room_type,
            geometry_mode, lighting, materials, atmosphere, provider, model,
            width, height, latency_ms, created_at, resolution, cost_usd, material_references
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.projectId,
            record.parentId || null,
            record.viewId || null,
            record.sourceImagePath,
            record.sourceImageBase64 || '',
            record.outputImagePath,
            record.outputImageBase64 || '',
            record.prompt,
            record.styleId,
            record.roomType,
            record.geometryMode,
            record.lighting || '',
            JSON.stringify(record.materials || []),
            record.atmosphere || '',
            record.provider,
            record.model,
            record.width,
            record.height,
            record.latencyMs,
            record.createdAt,
            record.resolution || '2k',
            record.costUsd || 0,
            JSON.stringify(record.materialReferences || []),
          ]
        );
        if (!result.success) throw new Error(result.error);
        // Also update project updated_at and thumbnail
        await window.electronAPI.dbExecute(
          `UPDATE projects SET updated_at = ?, thumbnail_path = ? WHERE id = ?`,
          [record.createdAt, '', record.projectId]
        );
        return;
      } catch (e) {
        console.error('db:saveGeneration error:', e);
        if (requirePersistence) throw e;
      }
    }

    this.inMemoryGenerations.push(record);
    const p = this.inMemoryProjects.find((x) => x.id === record.projectId);
    if (p) {
      p.updatedAt = record.createdAt;
      p.thumbnailPath = '';
    }
    this.saveFallbackData();
  }

  async getGenerationsForProject(projectId: string): Promise<GenerationRecord[]> {
    if (window.electronAPI) {
      try {
        const rows = await window.electronAPI.dbQuery(
          'SELECT * FROM generations WHERE project_id = ? ORDER BY created_at ASC',
          [projectId]
        );
        return rows.map((r: any) => ({
          id: r.id,
          projectId: r.project_id,
          parentId: r.parent_id,
          viewId: r.view_id,
          sourceImagePath: r.source_image_path,
          sourceImageBase64: r.source_image_base64,
          outputImagePath: r.output_image_path,
          outputImageBase64: r.output_image_base64,
          prompt: r.prompt,
          styleId: r.style_id,
          roomType: r.room_type,
          geometryMode: r.geometry_mode,
          lighting: r.lighting,
          materials: r.materials ? JSON.parse(r.materials) : [],
          atmosphere: r.atmosphere,
          provider: r.provider,
          model: r.model,
          width: r.width,
          height: r.height,
          latencyMs: r.latency_ms,
          createdAt: r.created_at,
          resolution: r.resolution || '2k',
          costUsd: r.cost_usd || 0,
          materialReferences: r.material_references ? JSON.parse(r.material_references) : [],
        }));
      } catch (e) {
        console.error('db:getGenerationsForProject error:', e);
      }
    }
    return this.inMemoryGenerations.filter((g) => g.projectId === projectId);
  }

  async getGenerationById(id: string): Promise<GenerationRecord | null> {
    if (window.electronAPI) {
      try {
        const rows = await window.electronAPI.dbQuery('SELECT * FROM generations WHERE id = ?', [id]);
        const r = rows[0];
        if (!r) return null;
        return {
          id: r.id,
          projectId: r.project_id,
          parentId: r.parent_id,
          viewId: r.view_id,
          sourceImagePath: r.source_image_path,
          sourceImageBase64: r.source_image_base64,
          outputImagePath: r.output_image_path,
          outputImageBase64: r.output_image_base64,
          prompt: r.prompt,
          styleId: r.style_id,
          roomType: r.room_type,
          geometryMode: r.geometry_mode,
          lighting: r.lighting,
          materials: r.materials ? JSON.parse(r.materials) : [],
          atmosphere: r.atmosphere,
          provider: r.provider,
          model: r.model,
          width: r.width,
          height: r.height,
          latencyMs: r.latency_ms,
          createdAt: r.created_at,
          resolution: r.resolution || '2k',
          costUsd: r.cost_usd || 0,
          materialReferences: r.material_references ? JSON.parse(r.material_references) : [],
        };
      } catch (e) {
        console.error('db:getGenerationById error:', e);
      }
    }
    return this.inMemoryGenerations.find((record) => record.id === id) || null;
  }

  async deleteGeneration(id: string): Promise<void> {
    if (window.electronAPI) {
      try {
        await window.electronAPI.dbExecute('DELETE FROM generations WHERE id = ?', [id]);
        return;
      } catch (e) {
        console.error('db:deleteGeneration error:', e);
      }
    }
    this.inMemoryGenerations = this.inMemoryGenerations.filter((g) => g.id !== id);
    this.saveFallbackData();
  }

  async getAllGenerations(): Promise<GenerationRecord[]> {
    if (window.electronAPI) {
      try {
        const rows = await window.electronAPI.dbQuery(
          'SELECT * FROM generations ORDER BY created_at DESC'
        );
        return rows.map((r: any) => ({
          id: r.id,
          projectId: r.project_id,
          parentId: r.parent_id,
          viewId: r.view_id,
          sourceImagePath: r.source_image_path,
          sourceImageBase64: r.source_image_base64,
          outputImagePath: r.output_image_path,
          outputImageBase64: r.output_image_base64,
          prompt: r.prompt,
          styleId: r.style_id,
          roomType: r.room_type,
          geometryMode: r.geometry_mode,
          lighting: r.lighting,
          materials: r.materials ? JSON.parse(r.materials) : [],
          atmosphere: r.atmosphere,
          provider: r.provider,
          model: r.model,
          width: r.width,
          height: r.height,
          latencyMs: r.latency_ms,
          createdAt: r.created_at,
          resolution: r.resolution || '2k',
          costUsd: r.cost_usd || 0,
          materialReferences: r.material_references ? JSON.parse(r.material_references) : [],
        }));
      } catch (e) {
        console.error('db:getAllGenerations error:', e);
      }
    }
    return [...this.inMemoryGenerations].sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const dbService = new DatabaseService();
