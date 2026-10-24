// Full-horizon bounds were computed offline from the saved candidates. Fetch
// only the selected update's chunk; never replace its online verification log.
export class FullTubeStore {
  constructor(base, fetcher=(...args)=>fetch(...args), expectedHash=null) {
    this.base=base;this.fetcher=fetcher;this.manifest=null;this.chunks=new Map();
    this.expectedHash=expectedHash;
  }
  async read(name) {
    const response=await this.fetcher(`${this.base}/${name}?v=1`,{cache:'no-cache'});
    if(!response.ok)throw new Error(`Full-candidate bounds could not be loaded (${response.status}).`);
    return response.json();
  }
  async load(index, epoch) {
    this.manifest??=this.read('manifest.json');
    const manifest=await this.manifest;
    if(this.expectedHash&&manifest.identity?.input_sha256!==this.expectedHash)
      throw new Error('Full-candidate bounds belong to a different flight recording.');
    const chunkNumber=Math.floor(index/manifest.chunk_size);
    const name=`${String(chunkNumber).padStart(3,'0')}.json`;
    if(!manifest.chunks.includes(name))throw new Error('No full-candidate recording is available for this update.');
    if(!this.chunks.has(name))this.chunks.set(name,this.read(name));
    const chunk=await this.chunks.get(name);
    if(this.expectedHash&&chunk.identity?.input_sha256!==this.expectedHash)
      throw new Error('Full-candidate chunk belongs to a different flight recording.');
    // Keep navigation bounded in memory. Loading a different chunk must not
    // alter the current selection or carry bounds across environments.
    while(this.chunks.size>4)this.chunks.delete(this.chunks.keys().next().value);
    const row=chunk.epochs.find(item=>item.epoch_index===index);
    if(!row||Math.abs(row.time-epoch.time)>1e-8||row.candidates.length!==epoch.candidates.length||
        row.candidates.some((item,i)=>Math.abs(item.switch_seconds-epoch.candidates[i].switch_seconds)>1e-8)) {
      throw new Error('Full-candidate bounds do not match the selected recording.');
    }
    return row;
  }
}

export function selectedBounds(candidate, continuation, mode) {
  return mode==='full'?continuation?.position_bounds:candidate?.position_bounds;
}
