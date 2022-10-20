from notion.client import NotionClient

# Obtain the `token_v2` value by inspecting your browser cookies on a logged-in (non-guest) session on Notion.so
client = NotionClient(token_v2="<token_v2>")

# Send a JSON document to a notion database with the notion client
def sendToNotionRecipesDB(jsonDocument):
    # Replace this URL with the URL of the page you want to edit
    page = client.get_block("https://www.notion.so/brianvia/e2d9f2d38b3d44b7b24172b478d0e66f?v=7b5cbb1e912641679c985f955876a2ba")

    # Replace this URL with the URL of the database you want to edit
    recipesCollection = client.get_collection_view("https://www.notion.so/brianvia/e2d9f2d38b3d44b7b24172b478d0e66f?v=7b5cbb1e912641679c985f955876a2ba")

    
    

    # Create a new row in the database
    new_row = recipesCollection.collection.add_row()

    # Set the column values
    new_row.name = jsonDocument['name']
    new_row.description = jsonDocument['description']
    new_row.ingredients = jsonDocument['ingredients']
    new_row.directions = jsonDocument['directions']
    new_row.tags = jsonDocument['tags']
    

    return new_row