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
}

interface Grade {
  id: string
  name: string
  level: number
}

function Field({
  label,
  value,
  onChange,
  type = 'number',
  disabled,
  min,
  max,
  step,
}: {
  label: string
  value: number | string | undefined
  onChange: (nextValue: string) => void
  type?: string
  disabled?: boolean
  min?: number
  max?: number
  step?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
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

  const isAdmin = user?.role === 'SUPER_ADMIN'

  const fetchData = async () => {
    try {
      const [settingsRes, gradesRes] = await Promise.all([
        settingsApi.get(),
        settingsApi.getGrades(),
      ])
      setSettings(settingsRes.data.data)
      setEditedSettings(settingsRes.data.data)
      setGrades(gradesRes.data.data || [])
    } catch {
      toast.error('Khong the tai du lieu')
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
      })
      toast.success('Luu cai dat thanh cong')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Luu cai dat that bai')
    } finally {
      setSaving(false)
    }
  }

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await settingsApi.createGrade(newGrade)
      toast.success('Them khoi thanh cong')
      setShowAddGrade(false)
      setNewGrade({ name: '', level: 10 })
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Them khoi that bai')
    }
  }

  const handleDeleteGrade = async (id: string) => {
    if (!confirm('Ban co chac muon xoa khoi nay?')) return
    try {
      await settingsApi.deleteGrade(id)
      toast.success('Xoa khoi thanh cong')
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Xoa khoi that bai')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thay doi quy dinh</h1>
        <p className="text-gray-600 text-sm mt-1">Bo tri gon 2 cot de de thao tac va de quan sat hon.</p>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'general', label: 'Quy dinh chung', icon: SettingsIcon },
            { key: 'grades', label: 'Khoi lop', icon: Users },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'general' | 'grades')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Do tuoi hoc sinh</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tuoi toi thieu" value={editedSettings.minAge} onChange={(v) => setEditedSettings((prev) => ({ ...prev, minAge: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                    <Field label="Tuoi toi da" value={editedSettings.maxAge} onChange={(v) => setEditedSettings((prev) => ({ ...prev, maxAge: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Si so toi da moi lop</h3>
                  <Field label="So hoc sinh/lop" value={editedSettings.maxClassSize} onChange={(v) => setEditedSettings((prev) => ({ ...prev, maxClassSize: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                </section>

                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Diem dat</h3>
                  <Field label="Diem trung binh dat" value={editedSettings.passScore} onChange={(v) => setEditedSettings((prev) => ({ ...prev, passScore: parseFloat(v || '0') }))} step="0.1" disabled={!isAdmin} />
                </section>

                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Quy dinh khoi lop</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Khoi toi thieu" value={editedSettings.minGradeLevel} onChange={(v) => setEditedSettings((prev) => ({ ...prev, minGradeLevel: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                    <Field label="Khoi toi da" value={editedSettings.maxGradeLevel} onChange={(v) => setEditedSettings((prev) => ({ ...prev, maxGradeLevel: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> So mon hoc toi da</h3>
                  <Field label="So mon/khoi" value={editedSettings.maxSubjects} onChange={(v) => setEditedSettings((prev) => ({ ...prev, maxSubjects: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                </section>

                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Thang diem</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Diem toi thieu" value={editedSettings.minScore} onChange={(v) => setEditedSettings((prev) => ({ ...prev, minScore: parseFloat(v || '0') }))} step="0.1" disabled={!isAdmin} />
                    <Field label="Diem toi da" value={editedSettings.maxScore} onChange={(v) => setEditedSettings((prev) => ({ ...prev, maxScore: parseFloat(v || '0') }))} step="0.1" disabled={!isAdmin} />
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Hoc ky</h3>
                  <Field label="So hoc ky toi da" value={editedSettings.maxSemesters} onChange={(v) => setEditedSettings((prev) => ({ ...prev, maxSemesters: parseInt(v || '0', 10) }))} disabled={!isAdmin} />
                </section>
              </div>

              {isAdmin ? (
                <div className="pt-2">
                  <button onClick={handleSaveSettings} disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Luu thay doi
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Danh sach khoi</h3>
                {isAdmin ? (
                  <button onClick={() => setShowAddGrade(true)} className="btn-primary text-sm">
                    <Plus className="h-4 w-4 mr-1" /> Them khoi
                  </button>
                ) : null}
              </div>

              {showAddGrade ? (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="card p-6 w-full max-w-md">
                    <h2 className="text-lg font-semibold mb-4">Them khoi</h2>
                    <form onSubmit={handleAddGrade} className="space-y-4">
                      <div>
                        <label className="label">Ten khoi</label>
                        <input type="text" className="input" value={newGrade.name} onChange={(e) => setNewGrade((prev) => ({ ...prev, name: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="label">Cap lop</label>
                        <input type="number" className="input" value={newGrade.level} onChange={(e) => setNewGrade((prev) => ({ ...prev, level: parseInt(e.target.value || '0', 10) }))} required />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddGrade(false)} className="btn-outline flex-1">Huy</button>
                        <button type="submit" className="btn-primary flex-1">Them</button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {grades.map((grade) => (
                  <div key={grade.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{grade.name}</p>
                      <p className="text-sm text-gray-500">Cap {grade.level}</p>
                    </div>
                    {isAdmin ? (
                      <button onClick={() => handleDeleteGrade(grade.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isAdmin ? (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">Chi SUPER_ADMIN moi co the thay doi quy dinh.</p>
        </div>
      ) : null}
    </div>
  )
}
