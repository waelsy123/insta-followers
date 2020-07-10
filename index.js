const axios = require('axios')
const { Client } = require('pg')
const fetch = require('node-fetch')
const _ = require('lodash')
var Sentencer = require('sentencer')
var fs = require('fs')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
)

// https://www.instagram.com/p/CCIQ3YXBavI/

const headers = {
  accept: '*/*',
  'accept-language':
    'en-US,en;q=0.9,ar;q=0.8,pl;q=0.7,fr;q=0.6,de;q=0.5,cs;q=0.4,und;q=0.3,eu;q=0.2,es;q=0.1',
  'content-type': 'application/x-www-form-urlencoded',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'x-csrftoken': '93xYGgL1ts8Jl5vUdqSKwdGuxPtx0Vty',
  'x-ig-app-id': '936619743392459',
  'x-ig-www-claim': 'hmac.AR0bIjCZItETLSMdVSk2ilEZmLlxqj8W5Rhatscpr2jKvd8V',
  'x-instagram-ajax': '34ee038877db',
  'x-requested-with': 'XMLHttpRequest',
  cookie:
    'ig_cb=1; mid=W-oEIAAEAAFYNhD7hm8brqujYRD2; mcd=3; csrftoken=93xYGgL1ts8Jl5vUdqSKwdGuxPtx0Vty; ds_user_id=1522361240; sessionid=1522361240%3AmTDXEqw5j50OwW%3A5; ig_did=1324A1A7-0650-4BC8-88ED-D836B9DFC62E; shbid=6622; datr=YfrsXsl2Nreeblpnv0eV6ZWV; shbts=1594042391.3435924; rur=VLL; urlgen="{\\"95.90.242.131\\": 31334\\054 \\"2a02:8109:b540:2278:51b4:cf61:aa96:1f99\\": 31334\\054 \\"2a02:8109:b540:2278:c19d:bb5:b102:7bb9\\": 31334}:1jsYEF:Pg5hPv2zCprLV2SQ5W7T3j8Azxo"'
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const connectToDatabase = async () => {
  const db = new Client({
    connectionString: `${process.env.DATABASE_URL}?ssl=true`
  })
  await db.connect()
  return db
}

function getRandomInt () {
  return (
    Math.floor(Math.random() * Math.floor(process.env.RANDOM_MAX)) +
    process.env.RANDOM_MIN
  )
}

function getRandomIntTillTen () {
  return Math.floor(Math.random() * Math.floor(10))
}

const getListOfUsersWhoLikePosts = async (db, queryHash, shortcode, after) => {
  const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables={"shortcode":"${shortcode}","include_reel":true,"first":${
    after ? '12' : '24'
  },"after":"${after}"}`

  const res = await axios
    .get(url, {
      headers,
      referrer: 'https://www.instagram.com/p/CBWJ6Lxlu6Y/',
      referrerPolicy: 'no-referrer-when-downgrade',
      body: null,
      method: 'GET',
      mode: 'cors'
    })
    .catch(err => {
      console.log('getListOfUsersWhoLikePosts -> err', err)
    })

  const data = res.data.data.shortcode_media.edge_liked_by
  const hasNext = data.page_info.has_next_page
  const users = data.edges.map(item => ({
    username: item.node.username,
    user_id: item.node.id
  }))

  console.log('getListOfUsersWhoLikePosts -> users', users)

  if (hasNext) {
    const newAfter = data.page_info.end_cursor
    console.log('getListOfUsersWhoLikePosts -> newAfter', newAfter)

    setTimeout(() => {
      getListOfUsersWhoLikePosts(db, queryHash, shortcode, newAfter)
    }, getRandomInt())
  }

  users.map(user => {
    try {
      db.query(
        `insert into instagram_usernames (username, user_id, followed) values ('${user.username}', '${user.user_id}', false)`
      )
    } catch (e) {}
  })
}

const follow = async db => {
  const user = (
    await db.query(
      `select * from instagram_usernames where followed=false and liked=false;`
    )
  ).rows[getRandomIntTillTen()]

  console.log(
    'follow -> user',
    `https://www.instagram.com/web/friendships/${user.user_id}/follow/`
  )

  try {
    const res = await fetch(
      `https://www.instagram.com/web/friendships/${user.user_id}/follow/`,
      {
        headers,
        referrer: `https://www.instagram.com/${user.username}/`,
        referrerPolicy: 'no-referrer-when-downgrade',
        body: null,
        method: 'POST',
        mode: 'cors'
      }
    )

    console.log('followed: ', user.username)
  } catch (e) {
    console.log('follow -> e', e)
  }

  await db.query(
    `update "instagram_usernames" set followed=true and updated_at=now() where username='${user.username}';`
  )

  const random = getRandomInt()

  await sleep(getRandomInt())
  return follow(db)
}

const like = async db => {
  const user = (
    await db.query(
      `select * from instagram_usernames where followed=false and liked=false;`
    )
  ).rows[getRandomIntTillTen() + 10]

  console.log('getListOfUsersWhoLikePosts -> user', user)

  try {
    await likePostsByUsername(user.username)
    console.log('like -> liked', user.username)
  } catch (e) {
    console.log('like -> e', e)
  }

  await db.query(
    `update "instagram_usernames" set liked=true and updated_at=now() where username='${user.username}';`
  )

  await sleep(getRandomInt())
  return like(db)
}

Sentencer.configure({
  actions: {
    pronoun: function () {
      const random = Math.floor(Math.random() * 10)
      return [
        'well',
        'I',
        'he',
        'she',
        'it is',
        'that',
        'this',
        'yep',
        'they',
        'gonna',
        'She',
        'We'
      ][random]
    },
    reaction: function () {
      const random = Math.floor(Math.random() * 14)
      return [
        'hahaha! ',
        'wow! ',
        '',
        '',
        'here we go!! ',
        'no way! ',
        'hmm, ',
        '',
        '',
        'that one, ',
        'yep, ',
        '',
        'look at that, ',
        'let see, ',
        'I think, '
      ][random]
    },
    extra: function () {
      const random = Math.floor(Math.random() * 17)
      return [
        'I think, ',
        'I beleive, ',
        'let me see, ',
        '',
        'that explain ',
        'something is happening here ',
        'inspiration is awesome ',
        'beleive me , ',
        '',
        'yo mate ',
        'let us hope ',
        'nice to know ',
        'I berely ',
        '',
        'let me explain ',
        '',
        'ok then '
      ][random]
    }
  }
})

const sentenceGenerator = () => {
  const comment = Sentencer.make(
    '{{ reaction }}{{ extra }}{{ pronoun }} {{ noun }} {{ an_adjective }} {{ noun }}'
  )
  return comment
}

const commentOnPosts = async (medias, i) => {
  if (!medias[i]) {
    const trendy = await getTrendyPosts()
    console.log('main -> trendy', trendy)
    await commentOnPosts(trendy, 0)
    return
  }

  const { id, code } = medias[i]
  console.log('commentOnPosts -> code ::', code)

  const comment = sentenceGenerator()
  console.log('commentOnPosts -> comment :: ', comment)

  fs.appendFile('comments.txt', `/${code}  ${comment}`, function (err) {
    if (err) {
      // append failed
    } else {
      // done
    }
  })

  await fetch(`https://www.instagram.com/web/comments/${id}/add/`, {
    headers,
    referrer: `https://www.instagram.com/p/${code}/`,
    referrerPolicy: 'no-referrer-when-downgrade',
    body: `comment_text=${comment.split(' ').join('+')}&replied_to_comment_id=`,
    method: 'POST',
    mode: 'cors'
  })

  setTimeout(() => {
    commentOnPosts(medias, i + 1)
  }, getRandomInt() * 8)

  return
}

const likePost = async ({ id, code }) => {
  await fetch(`https://www.instagram.com/web/likes/${id}/like/`, {
    headers,
    referrer: `https://www.instagram.com/p/${code}/`,
    referrerPolicy: 'no-referrer-when-downgrade',
    body: null,
    method: 'POST',
    mode: 'cors'
  })

  return
}

const getTrendyPosts = async () => {
  const res = await axios.get(
    'https://www.instagram.com/explore/grid/?is_prefetch=false&omit_cover_media=false&module=explore_popular&use_sectional_payload=true&cluster_id=explore_all%3A0&include_fixed_destinations=true&max_id=5',
    {
      headers,
      referrer: 'https://www.instagram.com/explore/',
      referrerPolicy: 'no-referrer-when-downgrade',
      body: null,
      method: 'GET',
      mode: 'cors'
    }
  )

  let medias = _.compact(
    res.data.sectional_items.map(item => item.layout_content.medias).flat(1)
  )

  medias = medias.map(item => ({ id: item.media.pk, code: item.media.code }))

  return medias
}

const getPostsByUsername = async username => {
  const res = await axios.get(`https://www.instagram.com/${username}/?__a=1`, {
    headers,
    referrer: 'https://www.instagram.com/explore/',
    referrerPolicy: 'no-referrer-when-downgrade',
    body: null,
    method: 'GET',
    mode: 'cors'
  })

  let medias = _.compact(
    res.data.graphql.user.edge_owner_to_timeline_media.edges.map(item => ({
      id: item.node.id,
      code: item.node.shortcode
    }))
  )

  return medias
}

const likePostsByUsername = async username => {
  const medias = await getPostsByUsername(username)

  if (medias.length < 3) {
    return
  }

  await likePost(medias[0])

  await sleep(getRandomInt())
  await likePost(medias[2])
}

const main = async () => {
  try {
    const db = await connectToDatabase()

    ////  comment on trendy posts
    // const trendy = await getTrendyPosts()
    // console.log('main -> trendy', trendy)
    // commentOnPosts(trendy, 0)

    // //  gether usernames
    // // todo add after has into file
    // await getListOfUsersWhoLikePosts(
    //   db,
    //   `${process.env.QUERY_HASH}`,
    //   `${process.env.POST_ID_TO_GET_USERS_FROM}`,
    //   'QVFDeXNvak4tQ2hrUDc3TVcwbk94cHFpZUM3Ni1RU2JUOXhkLXY1Skd5SC1TbmtFQ0FiSnpwektMS3I2ZUNxSkRVYzNFa3Fla3J1RGpjSUpFV0swM09Caw=='
    // )

    ////  follow usernames
    await sleep(getRandomInt() * 2)
    follow(db)

    ////  like usernames
    await sleep(getRandomInt())
    like(db)
  } catch (e) {
    console.log('main -> e', e)
  }
}

main()
