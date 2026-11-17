import json
import re
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal, engine
from app.models.speaking import SpeakingTopic


QUESTION_FILE = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "src"
    / "data"
    / "speakingQuestions.json"
)

EXPECTED_POINTS = {"part1": 4, "part2": 4, "part3": 3}


def read_topics():
    bank = json.loads(QUESTION_FILE.read_text(encoding="utf-8-sig"))
    rows = []
    keys = set()

    for part, expected_points in EXPECTED_POINTS.items():
        topics = bank[part]["topics"]
        if len(topics) != 12:
            raise ValueError(f"{part} should have 12 topics.")

        for position, topic in enumerate(topics, start=1):
            title = topic["title"].strip()
            prompt = topic["prompt"].strip()
            points = [point.strip() for point in topic["points"]]
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            key = (part, slug)

            if (
                not slug
                or len(title) > 180
                or not prompt
                or len(points) != expected_points
                or not all(points)
            ):
                raise ValueError(f"Invalid topic: {part}, set {position}.")

            if key in keys:
                raise ValueError(f"Duplicate topic: {part}, {title}.")

            keys.add(key)
            rows.append(
                SpeakingTopic(
                    part=part,
                    slug=slug,
                    title=title,
                    prompt=prompt,
                    points=points,
                    position=position,
                    status="published",
                )
            )

    return rows


def main():
    rows = read_topics()
    SpeakingTopic.__table__.create(bind=engine, checkfirst=True)

    with SessionLocal.begin() as db:
        existing = set(db.execute(
            select(SpeakingTopic.part, SpeakingTopic.slug)
        ).tuples().all())

        new_rows = [
            row for row in rows if (row.part, row.slug) not in existing
        ]
        db.add_all(new_rows)

    print(
        f"Speaking topics: {len(new_rows)} added, "
        f"{len(rows) - len(new_rows)} already present."
    )


if __name__ == "__main__":
    main()