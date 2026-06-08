# Score Entry Flow

Teacher or staff enters scores in one exact context:

```text
academicYear + semester + class + subject
```

## User Journey

1. Open `/scores`
2. Load academic years and semesters
3. Select academic year
4. Select semester
5. Load classes for that year and semester
6. Select class
7. Load subjects for that class and semester
8. Select subject
9. Load score sheet and score history
10. Save changed scores in batch

## Backend Checks

| Check | Rule |
|---|---|
| Semester entry | `semester.isActive === true` |
| Subject scope | subject must apply to selected class and academic year |
| Component scope | component must belong to `ScoreComponentSet(subjectId, semesterId)` |
| Student roster | resolved from `ClassEnrollment(semesterId)` first |
| Assignment scope | teacher/staff must have `TeacherAssignment(classId, subjectId, semesterId)` |
| Lock check | teacher cannot edit locked scores |

## Why This Flow

1. same class label can exist in many academic years
2. HK1 and HK2 can have different teachers
3. dropdowns must show the real state of the selected semester, not just the active year

## Related

- [Roles & Permissions](../authentication/roles-permissions.md)
- [API Endpoints](../backend/api-endpoints.md)
- [backend/src/routes/score.routes.js](../../../backend/src/routes/score.routes.js)
