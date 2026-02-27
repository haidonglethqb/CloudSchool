'use client'

import { useEffect, useState } from 'react'
import { settingsApi, subjectApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Plus,
  Trash2,
  BookOpen,
  Calendar,
  Users,
  Award,
  Edit2,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Settings {
  id: string
  minAge: number
  maxAge: number
  maxClassSize: number
  passScore: number
  quiz15Weight: number
  quiz45Weight: number
  finalWeight: number
}

interface Subject {
  id: string
  name: string
  code: string
  isActive: boolean
}

interface Semester {
  id: string
  name: string
  year: number
  term: number
  isActive: boolean
}

interface Grade {
  id: string
  name: string
  level: number
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'subjects' | 'semesters' | 'grades'>('general')

  // Form states
  const [editedSettings, setEditedSettings] = useState<Partial<Settings>>({})
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [showAddSemester, setShowAddSemester] = useState(false)
  const [showAddGrade, setShowAddGrade] = useState(false)
  const [newSubject, setNewSubject] = useState({ name: '', code: '' })
  const [newSemester, setNewSemester] = useState({ name: '', year: new Date().getFullYear(), term: 1 })
  const [newGrade, setNewGrade] = useState({ name: '', level: 10 })

  const fetchData = async () => {
    try {
      const [settingsRes, subjectsRes, semestersRes, gradesRes] = await Promise.all([
        settingsApi.get(),
        subjectApi.list(),
        subjectApi.getSemesters(),
        settingsApi.getGrades(),
      ])
      setSettings(settingsRes.data.data)
      setEditedSettings(settingsRes.data.data)
      setSubjects(subjectsRes.data.data)
      setSemesters(semestersRes.data.data)
      setGrades(gradesRes.data.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      await settingsApi.update(editedSettings)
      toast.success('Lưu cài đặt thành công')
      fetchData()
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Lưu cài đặt thất bại'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await subjectApi.create(newSubject)
      toast.success('Thêm môn học thành công')
      setShowAddSubject(false)
      setNewSubject({ name: '', code: '' })
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thêm môn học thất bại')
    }
  }

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa môn học này?')) return
    try {
      await subjectApi.delete(id)
      toast.success('Xóa môn học thành công')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xóa môn học thất bại')
    }
  }

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await subjectApi.createSemester(newSemester)
      toast.success('Thêm học kỳ thành công')
      setShowAddSemester(false)
      setNewSemester({ name: '', year: new Date().getFullYear(), term: 1 })
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thêm học kỳ thất bại')
    }
  }

  const handleSetActiveSemester = async (id: string) => {
    try {
      await subjectApi.setActiveSemester(id)
      toast.success('Đã đặt học kỳ hiện tại')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Không thể đặt học kỳ')
    }
  }

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await settingsApi.createGrade(newGrade)
      toast.success('Thêm khối thành công')
      setShowAddGrade(false)
      setNewGrade({ name: '', level: 10 })
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Thêm khối thất bại')
    }
  }

  const handleDeleteGrade = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa khối này?')) return
    try {
      await settingsApi.deleteGrade(id)
      toast.success('Xóa khối thành công')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xóa khối thất bại')
    }
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thay đổi quy định</h1>
        <p className="text-gray-600 text-sm mt-1">
          QD - Quản lý các quy định và cài đặt của trường
        </p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {[
            { key: 'general', label: 'QD1-5: Quy định chung', icon: SettingsIcon },
            { key: 'subjects', label: 'QD4: Môn học', icon: BookOpen },
            { key: 'semesters', label: 'Học kỳ', icon: Calendar },
            { key: 'grades', label: 'QD3: Khối lớp', icon: Users },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* QD1: Age Rules */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  QD1 - Quy định độ tuổi học sinh
                </h3>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="label">Tuổi tối thiểu</label>
                    <input
                      type="number"
                      className="input"
                      value={editedSettings.minAge || ''}
                      onChange={(e) =>
                        setEditedSettings({ ...editedSettings, minAge: parseInt(e.target.value) })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <label className="label">Tuổi tối đa</label>
                    <input
                      type="number"
                      className="input"
                      value={editedSettings.maxAge || ''}
                      onChange={(e) =>
                        setEditedSettings({ ...editedSettings, maxAge: parseInt(e.target.value) })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>

              {/* QD2: Class Size */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  QD2 - Sĩ số tối đa mỗi lớp
                </h3>
                <div className="max-w-xs">
                  <label className="label">Số học sinh/lớp</label>
                  <input
                    type="number"
                    className="input"
                    value={editedSettings.maxClassSize || ''}
                    onChange={(e) =>
                      setEditedSettings({ ...editedSettings, maxClassSize: parseInt(e.target.value) })
                    }
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              {/* QD5: Pass Score */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  QD5 - Điểm đạt
                </h3>
                <div className="max-w-xs">
                  <label className="label">Điểm trung bình đạt</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    className="input"
                    value={editedSettings.passScore || ''}
                    onChange={(e) =>
                      setEditedSettings({ ...editedSettings, passScore: parseFloat(e.target.value) })
                    }
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              {/* Score Weights */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Hệ số điểm
                </h3>
                <div className="grid grid-cols-3 gap-4 max-w-lg">
                  <div>
                    <label className="label">15 phút</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={editedSettings.quiz15Weight || ''}
                      onChange={(e) =>
                        setEditedSettings({ ...editedSettings, quiz15Weight: parseFloat(e.target.value) })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <label className="label">1 tiết</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={editedSettings.quiz45Weight || ''}
                      onChange={(e) =>
                        setEditedSettings({ ...editedSettings, quiz45Weight: parseFloat(e.target.value) })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <label className="label">Cuối kỳ</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={editedSettings.finalWeight || ''}
                      onChange={(e) =>
                        setEditedSettings({ ...editedSettings, finalWeight: parseFloat(e.target.value) })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              {isAdmin && (
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lưu thay đổi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Danh sách môn học (QD4)</h3>
                {isAdmin && (
                  <button onClick={() => setShowAddSubject(true)} className="btn-primary text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Thêm môn
                  </button>
                )}
              </div>

              {/* Add Subject Modal */}
              {showAddSubject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="card p-6 w-full max-w-md">
                    <h2 className="text-lg font-semibold mb-4">Thêm môn học</h2>
                    <form onSubmit={handleAddSubject} className="space-y-4">
                      <div>
                        <label className="label">Tên môn</label>
                        <input
                          type="text"
                          className="input"
                          value={newSubject.name}
                          onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Mã môn</label>
                        <input
                          type="text"
                          className="input"
                          value={newSubject.code}
                          onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })}
                          required
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddSubject(false)} className="btn-outline flex-1">
                          Hủy
                        </button>
                        <button type="submit" className="btn-primary flex-1">
                          Thêm
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Subjects List */}
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {subjects.map((subject) => (
                  <div key={subject.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{subject.name}</p>
                      <p className="text-sm text-gray-500">{subject.code}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Semesters Tab */}
          {activeTab === 'semesters' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Danh sách học kỳ</h3>
                {isAdmin && (
                  <button onClick={() => setShowAddSemester(true)} className="btn-primary text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Thêm học kỳ
                  </button>
                )}
              </div>

              {/* Add Semester Modal */}
              {showAddSemester && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="card p-6 w-full max-w-md">
                    <h2 className="text-lg font-semibold mb-4">Thêm học kỳ</h2>
                    <form onSubmit={handleAddSemester} className="space-y-4">
                      <div>
                        <label className="label">Tên học kỳ</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="VD: Học kỳ 1 - 2024-2025"
                          value={newSemester.name}
                          onChange={(e) => setNewSemester({ ...newSemester, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Năm học</label>
                          <input
                            type="number"
                            className="input"
                            value={newSemester.year}
                            onChange={(e) => setNewSemester({ ...newSemester, year: parseInt(e.target.value) })}
                            required
                          />
                        </div>
                        <div>
                          <label className="label">Học kỳ</label>
                          <select
                            className="input"
                            value={newSemester.term}
                            onChange={(e) => setNewSemester({ ...newSemester, term: parseInt(e.target.value) })}
                          >
                            <option value={1}>Học kỳ 1</option>
                            <option value={2}>Học kỳ 2</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddSemester(false)} className="btn-outline flex-1">
                          Hủy
                        </button>
                        <button type="submit" className="btn-primary flex-1">
                          Thêm
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Semesters List */}
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {semesters.map((semester) => (
                  <div key={semester.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{semester.name}</p>
                        <p className="text-sm text-gray-500">
                          Năm {semester.year} - HK{semester.term}
                        </p>
                      </div>
                      {semester.isActive && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Hiện tại
                        </span>
                      )}
                    </div>
                    {isAdmin && !semester.isActive && (
                      <button
                        onClick={() => handleSetActiveSemester(semester.id)}
                        className="btn-outline text-sm"
                      >
                        Đặt hiện tại
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grades Tab */}
          {activeTab === 'grades' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Danh sách khối (QD3)</h3>
                {isAdmin && (
                  <button onClick={() => setShowAddGrade(true)} className="btn-primary text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Thêm khối
                  </button>
                )}
              </div>

              {/* Add Grade Modal */}
              {showAddGrade && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="card p-6 w-full max-w-md">
                    <h2 className="text-lg font-semibold mb-4">Thêm khối</h2>
                    <form onSubmit={handleAddGrade} className="space-y-4">
                      <div>
                        <label className="label">Tên khối</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="VD: Khối 10"
                          value={newGrade.name}
                          onChange={(e) => setNewGrade({ ...newGrade, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Cấp lớp</label>
                        <input
                          type="number"
                          className="input"
                          value={newGrade.level}
                          onChange={(e) => setNewGrade({ ...newGrade, level: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddGrade(false)} className="btn-outline flex-1">
                          Hủy
                        </button>
                        <button type="submit" className="btn-primary flex-1">
                          Thêm
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Grades List */}
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {grades.map((grade) => (
                  <div key={grade.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{grade.name}</p>
                      <p className="text-sm text-gray-500">Cấp {grade.level}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteGrade(grade.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
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
          <p className="text-sm text-amber-800">
            Chỉ Admin mới có thể thay đổi các quy định. Liên hệ quản trị viên để thay đổi cài đặt.
          </p>
        </div>
      )}
    </div>
  )
}
