import {make_logger, sleep} from "josh_js_util"
import {getFiles, read_json_file } from "josh_node_util"
const log = make_logger("BUILD")

export function gen_id(prefix) {
    return `${prefix}_${Math.floor(Math.random() * 100_000_000)}`
}

/*
- [ ] generate data.JSON using actual file data.
- [ ] use the josh_node_util for automating it
- [ ] generate IDs based on dir names and types
- [ ] Recursive traversal of directories. Filter out files we want to skip. Make it a list? Iterator? Async iterator?
    - [ ] Generate list of db objects
- [ ] Include mime type for mp3s and other files
- [ ] Create a new image type
- [ ] Append people and other custom items
- [ ] Save out to file
*/

import {promises as fs} from "fs"
import crypto from 'crypto'
import path from "path"

async function get_mp3s() {
    let mp3s = await getFiles("mp3s",async (file) => {
        if(file.endsWith(".DS_Store")) return;
        if(path.extname(file) === '.zip') return
        if(path.extname(file) !== '.mp3') return
        let parts = path.parse(file)
        let basedir = path.basename(parts.dir);
        let title = parts.name.split('-')[1].trim();
        let artist = basedir.split('-')[0].trim()
        let album  = basedir.split('-')[1].trim()
        let raw = await fs.readFile(file)
        let hsh = crypto.createHash('sha256').update(raw).digest('hex')
        let item = {
            id:`song_${hsh}`,
            data: {
                "type": "song-track",
                "mimetype":"audio/mpeg",
                "title": title,
                "artist": artist,
                "album": album,
                "filepath": file
            }
        }
        return item
    })
    //get rid of undefined
    mp3s = mp3s.flat()
    mp3s = mp3s.filter(i => i !== undefined)
    // console.log("items",mp3s)
    return mp3s
}

const EXT_TO_MIMETYPE = {
    '.jpg':'image/jpeg'
}
async function get_images() {
    let files = await getFiles("images",async (file) => {
        let parsed = path.parse(file)
        let raw = await fs.readFile(file)
        let hsh = crypto.createHash('sha256').update(raw).digest('hex')
        let filesize = await fs.stat(file)
        return {
            file:file,
            parsed:parsed,
            hash:hsh,
            filesize:filesize.size,
        }
    })
    files = files.flat()
    files = files.filter(p => p.parsed.ext === '.jpg')
    files = files.map(p => {
        let ext = p.parsed.ext.toLowerCase()
        let item =  {
            id:"image_"+p.hash,
            data: {
                "type": "image",
                "mimetype":EXT_TO_MIMETYPE[ext],
                "filepath": p.file,
                filesize:p.filesize,
            }
        }
        console.log(p, ext, EXT_TO_MIMETYPE[ext], item)
        return item
    })
    log.info("files",files)
    return files
}

async function get_people() {
    let people = await read_json_file("people.json")
    people.forEach((p,i) => {
        p.id = `person_${i}`
        p.data.type = 'person-contact'
    })
    return people
}

async function write_json_file(filename, object) {
    await fs.writeFile(filename, JSON.stringify(object,null,"   "));
}

async function runit() {
    let mp3s = await get_mp3s()
    let images = await get_images()
    let people = await get_people();
    let items = [].concat(mp3s,images,people)
    let data = {
        data:items,
    }
    log.info(data.data.length)
    await write_json_file("data.json",data)
}

runit().then((r)=>log.info('done',r)).catch(e => log.error(e))
