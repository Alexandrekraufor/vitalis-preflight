import type { GuideDetail, GuideRepository } from "../ports/guide-repository.port";

/**
 * Everything the guide detail screen, the REST `GET /guides/{id}` route and the
 * MCP `consultar_guia` tool show — read once, from one place.
 */
export function getGuide(
  idGuia: string,
  guides: GuideRepository,
): Promise<GuideDetail | null> {
  return guides.findDetail(idGuia.trim());
}
