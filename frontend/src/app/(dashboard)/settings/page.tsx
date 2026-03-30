'use client'

import { useEffect, useState } from 'react'
import { settingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Plus,
  Trash2,
  Users,
  Award,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Settings {
  id: string
  minAge: number
  maxAge: number
  maxClassSize: number
  passScore: number
  minGradeLevel: number
  maxGradeLevel: number
  maxSubjects: number
  minScore: number
  maxScore: number
  maxSemesters: number
  maxRetentions: number
}

interface Grade {
  id: string
  name: string
  level: number
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'grades'>('general')

  const [editedSettings, setEditedSettings] = useState<Partial<Settings>>({})
  const [showAddGrade, setShowAddGrade] = useState(false)
  const [newGrade, setNewGrade] = useState({ name: '', level: 10 })

  const fetchData = async () => {
    try {
      const [settingsRes, gradesRes] = await Promise.all([
        settingsApi.get(),
        settingsApi.getGrades(),
      ])
      setSettings(settingsRes.data.data)
      setEditedSettings(settingsRes.data.data)
      setGrades(gradesRes.data.data)
    } catch {
      toast.error('Không thể tải dữ liệu')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      await settingsApi.update({
        minAge: editedSettings.minAge,
        maxAge: editedSettings.maxAge,
        maxClassSize: editedSettings.maxClassSize,
        passScore: editedSettings.passScore,
        minGradeLevel: editedSettings.minGradeLevel,
        maxGradeLevel: editedSettings.maxGradeLevel,
        maxSubjects: editedSettings.maxSubjects,
        minScore: editedSettings.minScore,
        maxScore: editedSettings.maxScore,
        maxSemesters: editedSettings.maxSemesters,
        maxRetentions: editedSettings.maxRetentions,
      })
      toast.success('Lưu cài đặt thành công')
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lưu cài đặt thất bại')
    } finally { setSaving(false) }
  }

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await settingsApi.createGrade(newGrade)
      toast.success('Thêm khối thành công')
      setShowAddGrade(false)
      setNewGrade({ name: '', level: 10 })
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Thêm khối thất bại')
    }
  }

  const handleDeleteGrade = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa khối này?')) return
    try {
      await settingsApi.deleteGrade(id)
      toast.success('Xóa khối thành công')
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Xóa khối thất bại')
    }
  }

  const isAdmin = user?.role === 'SUPER_ADMIN'

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thay đổi quy định</h1>
        <p className="text-gray-600 text-sm mt-1">Quản lý các quy định và cài đặt của trường</p>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'general', label: 'Quy định chung', icon: SettingsIcon },
            { key: 'grades', label: 'Khối lớp', icon: Users },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Age Rules */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Quy định độ tuổi học sinh
                </h3>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="label">Tuổi tối thiểu</label>
                    <input type="number" className="input" value={editedSettings.minAge || ''} onChange={e => setEditedSettings({ ...editedSettings, minAge: parseInt(e.target.value) })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <label className="label">Tuổi tối đa</label>
                    <input type="number" className="input" value={editedSettings.maxAge || ''} onChange={e => setEditedSettings({ ...editedSettings, maxAge: parseInt(e.target.value) })} disabled={!isAdmin} />
                  </div>
                </div>
              </div>

              {/* Class Size */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Sĩ số tối đa mỗi lớp
                </h3>
                <div className="max-w-xs">
                  <label className="label">Số học sinh/lớp</label>
                  <input type="number" className="input" value={editedSettings.maxClassSize || ''} onChange={e => setEditedSettings({ ...editedSettings, maxClassSize: parseInt(e.target.value) })} disabled={!isAdmin} />
                </div>
              </div>

              {/* Pass Score */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Điểm đạt
                </h3>
                <div className="max-w-xs">
                  <label className="label">Điểm trung bình đạt</label>
                  <input type="number" step="0.1" min="0" max="10" className="input" value={editedSettings.passScore || ''} onChange={e => setEditedSettings({ ...editedSettings, passScore: parseFloat(e.target.value) })} disabled={!isAdmin} />
                </div>
              </div>

              {/* Grade Level */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Quy định khối lớp
                </h3>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="label">Khối tối thiểu</label>
                    <input type="number" className="input" value={editedSettings.minGradeLevel || ''} onChange={e => setEditedSettings({ ...editedSettings, minGradeLevel: parseInt(e.target.value) })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <label className="label">Khối tối đa</label>
                    <input type="number" className="input" value={editedSettings.maxGradeLevel || ''} onChange={e => setEditedSettings({ ...editedSettings, maxGradeLevel: parseInt(e.target.value) })} disabled={!isAdmin} />
                  </div>
                </div>
              </div>

              {/* Max Subjects */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Số môn học tối đa
                </h3>
                <div className="max-w-xs">
                  <label className="label">Số môn/khối</label>
                  <input type="number" className="input" value={editedSettings.maxSubjects || ''} onChange={e => setEditedSettings({ ...editedSettings, maxSubjects: parseInt(e.target.value) })} disabled={!isAdmin} />
                </div>
              </div>

              {/* Score Range */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Thang điểm
                </h3>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="label">Điểm tối thiểu</label>
                    <input type="number" step="0.1" className="input" value={editedSettings.minScore ?? ''} onChange={e => setEditedSettings({ ...editedSettings, minScore: parseFloat(e.target.value) })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <label className="label">Điểm tối đa</label>
                    <input type="number" step="0.1" className="input" value={editedSettings.maxScore || ''} onChange={e => setEditedSettings({ ...editedSettings, maxScore: parseFloat(e.target.value) })} disabled={!isAdmin} />
                  </div>
                </div>
              </div>

              {/* Max Semesters & Retentions */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Học kỳ và lưu ban
                </h3>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="label">Số học kỳ tối đa</label>
                    <input type="number" className="input" value={editedSettings.maxSemesters || ''} onChange={e => setEditedSettings({ ...editedSettings, maxSemesters: parseInt(e.target.value) })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <label className="label">Số lần lưu ban tối đa</label>
                    <input type="number" className="input" value={editedSettings.maxRetentions || ''} onChange={e => setEditedSettings({ ...editedSettings, maxRetentions: parseInt(e.target.value) })} disabled={!isAdmin} />
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-gray-100">
                  <button onClick={handleSaveSettings} disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Lưu thay đổi
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'grades' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Danh sách khối</h3>
                {isAdmin && (
                  <button onClick={() => setShowAddGrade(true)} className="btn-primary text-sm">
                    <Plus className="w-4 h-4 mr-1" /> Thêm khối
                  </button>
                )}
              </div>

              {showAddGrade && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="card p-6 w-full max-w-md">
                    <h2 className="text-lg font-semibold mb-4">Thêm khối</h2>
                    <form onSubmit={handleAddGrade} className="space-y-4">
                      <div>
                        <label className="label">Tên khối</label>
                        <input type="text" className="input" placeholder="VD: Khối 10" value={newGrade.name} onChange={e => setNewGrade({ ...newGrade, name: e.target.value })} required />
                      </div>
                      <div>
                        <label className="label">Cấp lớp</label>
                        <input type="number" className="input" value={newGrade.level} onChange={e => setNewGrade({ ...newGrade, level: parseInt(e.target.value) })} required />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddGrade(false)} className="btn-outline flex-1">Hủy</button>
                        <button type="submit" className="btn-primary flex-1">Thêm</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {grades.map(grade => (
                  <div key={grade.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{grade.name}</p>
                      <p className="text-sm text-gray-500">Cấp {grade.level}</p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDeleteGrade(grade.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">Chỉ SUPER_ADMIN mới có thể thay đổi quy định.</p>
        </div>
      )}
    </div>
  )
}