import { MODULE_ID } from './shared.js';

// Identify the character responsible for an area, independently of its shape.
// Actor UUID is preferred to token id: two linked tokens of the same character
// must not allow the caster to target themselves via the second token.
export function casterIdentity(activity, templates=[]) {
  const actor=activity?.actor??activity?.item?.actor;
  let sourceTokenUuid=null;
  for(const entry of templates){
    const region=entry?.document??entry;
    if(region?.documentName!=='Region')continue;
    sourceTokenUuid=region.getFlag?.(MODULE_ID,'sourceTokenUuid')
      ??region.flags?.[MODULE_ID]?.sourceTokenUuid??null;
    if(sourceTokenUuid)break;
  }
  const placeables=globalThis.canvas?.tokens?.placeables??[];
  if(!sourceTokenUuid&&actor){
    // For unlinked NPCs, an activity sometimes belongs to the base actor but
    // the token has a synthetic Actor UUID. Use the unambiguously selected
    // token rather than making every NPC from the same prototype immune.
    const matches=placeables.filter(t=>t.actor?.uuid===actor.uuid||t.actor?.id===actor.id);
    const selected=matches.filter(t=>t.controlled);
    const source=selected.length===1?selected[0]:matches.length===1?matches[0]:null;
    sourceTokenUuid=source?.document?.uuid??null;
  }
  const sourceToken=sourceTokenUuid
    ?placeables.find(t=>t.document?.uuid===sourceTokenUuid)
    :null;
  return {
    casterUuid:actor?.uuid??sourceToken?.actor?.uuid??null,
    casterActorId:actor?.id??sourceToken?.actor?.id??null,
    // An unlinked NPC may use a synthetic Actor different from its base Actor.
    casterTokenActorUuid:sourceToken?.actor?.uuid??null,
    sourceTokenUuid
  };
}

export function isCasterActor(actor,identity={}) {
  if(!actor)return false;
  if(identity.casterUuid&&actor.uuid===identity.casterUuid)return true;
  if(identity.casterTokenActorUuid&&actor.uuid===identity.casterTokenActorUuid)return true;
  // Support area records written before casterTokenActorUuid was introduced.
  // Do not treat *all* copies of an unlinked NPC as the same actor.
  const source=identity.sourceTokenUuid&&(globalThis.canvas?.tokens?.placeables??[])
    .find(token=>token.document?.uuid===identity.sourceTokenUuid);
  if(source?.actor?.uuid===actor.uuid)return true;
  // Only use the less-specific id when no UUID is available.
  return !identity.casterUuid&&!!identity.casterActorId&&actor.id===identity.casterActorId;
}

export function isCasterToken(token,identity={}) {
  return !!token&&(isCasterActor(token.actor,identity)
    ||!!identity.sourceTokenUuid&&token.document?.uuid===identity.sourceTokenUuid);
}
