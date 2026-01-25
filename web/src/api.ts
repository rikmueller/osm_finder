import axios from 'axios'

const API_BASE = '/api'

export interface ConfigResponse {
  defaults: {
    project_name: string
    radius_km: number
    step_km: number | null
    include: string[]
    exclude: string[]
  }
  presets: string[]
  presets_detail: {
    [key: string]: {
      info?: string
      include: string[]
      exclude: string[]
    }
  }
}

export interface JobStatus {
  id: string
  state: 'queued' | 'processing' | 'completed' | 'failed'
  percent: number
  message: string
  project_name: string
  created_at: string
  excel_file: string | null
  html_file: string | null
  rows_count: number | null
  track_length_km: number | null
  error: string | null
}

export const apiClient = {
  async getConfig(): Promise<ConfigResponse> {
    const response = await axios.get(`${API_BASE}/config`)
    return response.data
  },

  async startProcessing(
    file: File,
    projectName: string,
    radiusKm: number,
    includes: string[],
    excludes: string[]
  ): Promise<{ job_id: string; status_url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_name', projectName)
    formData.append('radius_km', radiusKm.toString())
    includes.forEach((inc) => formData.append('include', inc))
    excludes.forEach((exc) => formData.append('exclude', exc))

    const response = await axios.post(`${API_BASE}/process`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await axios.get(`${API_BASE}/status/${jobId}`)
    return response.data
  },

  getExcelDownloadUrl(filename: string): string {
    return `${API_BASE}/download/excel/${filename}`
  },

  getHtmlMapUrl(filename: string): string {
    return `${API_BASE}/download/html/${filename}`
  },
}
