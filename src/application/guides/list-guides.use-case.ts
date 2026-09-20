import type {
  GuideListFilter,
  GuideListItem,
  GuideRepository,
} from "../ports/guide-repository.port";

export function listGuides(
  filter: GuideListFilter,
  guides: GuideRepository,
): Promise<readonly GuideListItem[]> {
  return guides.list(filter);
}
