import {make_logger} from "josh_js_util"
import {getFiles, read_json_file, generate_file_hash, write_json_file} from "josh_node_util"
import {promises as fs} from "fs"
import path from "path"

const log = make_logger("BUILD")

const EXT_TO_MIMETYPE = {
    '.jpg':'image/jpeg',
    '.png':'image/png',
    '.mp3':'audio/mpeg'
}

async function get_mp3s() {
    let mp3s = await getFiles("mp3s",async (file) => {
        if(path.extname(file) !== '.mp3') return log.info("skipping",file)
        log.info("processing",file)
        let parts = path.parse(file)
        let basedir = path.basename(parts.dir);
        return {
            id: `song_${await generate_file_hash(file)}`,
            data: {
                "type": "song-track",
                "mimetype": EXT_TO_MIMETYPE[parts.ext],
                "title": parts.name.split('-')[1].trim(),
                "artist": basedir.split('-')[0].trim(),
                "album": basedir.split('-')[1].trim(),
                "filepath": file
            }
        }
    })
    mp3s = mp3s.flat().filter(i => i !== undefined)
    return mp3s
}

async function get_images() {
    let files = await getFiles("images",async (file) => {
        let parsed = path.parse(file)
        let ext = parsed.ext.toLowerCase()
        if(ext !== '.jpg') return log.info("skipping",file)
        log.info("processing",file)
        return {
            id:"image_"+await generate_file_hash(file),
            data: {
                "type": "image",
                "mimetype":EXT_TO_MIMETYPE[ext],
                "filepath": file,
                filesize: (await fs.stat(file)).size,
            },
        }
    })
    files = files.flat().filter(i => i !== undefined)
    return files
}

async function get_people() {
    let people = await read_json_file("people.json")
    people.forEach((p,i) => {
        log.info("processing",p)
        p.id = `person_${i}`
        p.data.type = 'person-contact'
    })
    return people
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
