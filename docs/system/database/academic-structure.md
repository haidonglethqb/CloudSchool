# Academic Structure

Academic structure is tenant-scoped and year-aware.

## Core Models

| Model | Purpose |
|---|---|
| `AcademicYear` | School year, active flag, date window |
| `Semester` | Term inside an academic year; shared selectors expose `displayName` with year |
| `Grade` | Grade level such as 10, 11, 12 |
| `Class` | Class in a grade and academic year |
| `Subject` | Master subject catalog |
| `SubjectVersion` | Subject application for one academic year |

## Subject Scope

`Subject` is not enough to decide whether a class studies a subject.

Resolution uses:

1. `SubjectVersion(subjectId, academicYearId)`
2. `SubjectVersionClass` for class-specific scope
3. `SubjectVersionGrade` for grade-wide scope

If no class/grade scope matches, the subject does not apply to that class/year.

## Score Component Boundary

Score components are not scoped by `SubjectVersion`.

Components are configured by:

```text
Subject + Semester
```

See [Scoring Models](./scoring-models.md).

## Related

- [Schema Overview](./schema-overview.md)
- [Scoring Models](./scoring-models.md)
- [Score Entry Flow](../data-flows/score-entry-flow.md)
