import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest, res: NextResponse) {
  const searchParams = req.nextUrl ? new URL(req.url).searchParams : null
  const query = searchParams?.get("q")
  const url = `https://api.edamam.com/auto-complete?q=${query}&app_id=${process.env.FOOD_API_APP_ID}&app_key=${process.env.FOOD_API_APP_KEY}`
  console.log(url)
  const data = await fetch(url).then((response) => response.json())
  console.log(data)

  return NextResponse.json({
    data,
  })
}
