import axios from 'axios'
import sqlite from 'sqlite';
import config from './config'

//https://oauth.vk.com/token?grant_type=password&client_id=2274003&client_secret=hHbZxrka2uZ6jB1inYsH&username=${value.login}&password=${value.password}&2fa_supported=1

setTimeout(() => start(), 1000);
setInterval(() => start(), 3600*1000);

async function start () {
    try {
        let classDb = new db();
        await classDb.connect();

        let AddPost = await classDb.searchDate();
        console.log(AddPost)

        let time = GetTime(AddPost.date)
        console.log(time)

        /* время не прошло, останавливаемся */
        //if (time < config.out.hour) return

        console.log('Время прошло много, могу выложить')

        /* добавляем запись о том, что выложили новые посты */
        await classDb.addDate();

        //получение списка новостей
        let arPosts = await vk.wallGet();
        if (!arPosts) return
        console.log(arPosts)

        //ищем пост который еше не добавлен
        let arPostAdd = await classDb.searchPost(arPosts);
        if (!arPostAdd) return
        console.log(arPostAdd)

        //добавляем пост
        await vk.wallPost(arPostAdd, config.out.owner_ids);

        //сохраняем id поста который добавлен
        await classDb.addPost(arPostAdd.id);


    } catch (err) {
        console.log(err)
    }

}

//разница с последнего поста в часах
function GetTime (oldDate) {
    let newDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    oldDate = new Date(oldDate).getTime()
    newDate = new Date(newDate).getTime()

    return (newDate-oldDate) / 1000 / 60 / 60
}

class vk {
    static async wallGet() {
        try {
            //загрузка исходной стены
            let ownerId = config.in.owner_id
            let count = config.in.count
            let filter = config.in.filter
            let token = config.token

            //запрос
            let inUrl = `https://api.vk.com/method/wall.get?owner_id=${ownerId}&count=${count}&filter=${filter}&access_token=${token}&v=5.103`;
            console.log(inUrl)

            //запрос новостей
            let inResult = await axios({
                method: 'get',
                url: inUrl,
                headers: {'User-Agent': "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 YaBrowser/19.12.4.25 Yowser/2.5 Safari/537.36"}
            });

            if (!inResult.data.response.items.length)
                throw ({msg: 'Стена пустая'});

            return inResult.data.response.items

        } catch (err) {
            throw ({...{msg: 'Загрузка исходной стены'}, ...err});
        }
    }

    //выкладываем пост
    static async wallPost (post, arOut) {

        let newAttachments = [];

        for (let object of post.attachments) {
            if (object.type === "video") {
                newAttachments[newAttachments.length] = `video${object.video.owner_id}_${object.video.id}`;
            }
            if (object.type === "photo") {
                newAttachments[newAttachments.length] = `photo${object.photo.owner_id}_${object.photo.id}`;
            }
            if (object.type === "link") {
                newAttachments[newAttachments.length] = object.link.url;
            }
            if (object.type === "article") {
                newAttachments[newAttachments.length] = `article${object.article.owner_id}_${object.article.id}`;
            }
        }

        let newPost = {
            text: encodeURI(post.text),
            attachments: newAttachments.join(',')
        };

        //эмуляция, чтобы не забанили
        let time = 1000;
        for (let out of arOut) {

            console.log(time)
            setTimeout(async () => {
                let url = `https://api.vk.com/method/wall.post?owner_id=${out}&friends_only=${config.out.friends_only}&from_group=${config.out.from_group}&message=${newPost.text}&attachments=${newPost.attachments}&access_token=${config.token}&v=5.103`;
                console.log(url)

                //добавляем пост новостей
                let result = await axios({
                    method: 'post',
                    url: url,
                    headers: {'User-Agent': "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 YaBrowser/19.12.4.25 Yowser/2.5 Safari/537.36"},
                });
            }, time);

            time =5000;
        }

    }
}

class db {

    //подключение к базе
    async connect () {
        this.db = await sqlite.open('db/memory.db');
    }

    //поиск еще не добавленого поста
    async searchPost (arr) {
        try {
            //переворачиваем массив
            arr = arr.reverse();

            for (let post of arr) {

                let query = `SELECT * FROM posts WHERE vk_post_id=${post.id}`;
                console.log(query)
                let getPost = await this.db.all(query);
                console.log(getPost)
                if (getPost.length) continue;

                return post;
            }

            return false

        } catch (err) {
            throw (err);
        }
    }
    //добавляем пост
    async addPost (id) {
        try {
            //let date = new Date();
            let sqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

            let query = `INSERT INTO posts (vk_post_id) VALUES (${id})`;
            return await this.db.all(query);
        } catch (err) {
            throw (err);
        }
    }

    //поиск даты
    async searchDate () {
        try {
            let query = `SELECT * FROM addpost ORDER BY date DESC LIMIT 1`;
            query =  await this.db.all(query);

            if (!query.length) return false

            return query[0]
        } catch (err) {
            throw (err);
        }
    }

    //добавляем дату
    async addDate (db) {
        try {
            //let date = new Date();
            let sqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

            let query = `INSERT INTO addpost (date) VALUES ('${sqlDate}')`;
            return await this.db.all(query);
        } catch (err) {
            throw (err);
        }
    }

}