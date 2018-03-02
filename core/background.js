function ajax(url, callback) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open('GET', url, true);
    xmlhttp.onload = function() {
        callback(xmlhttp.responseText);
    };
    xmlhttp.send(null);
}

function main() {
    chrome['runtime']['onMessage'].addListener(function(request, sender, sendResponse) {
        if (request.action == "openTab") {
            chrome.tabs.create({
                url: request.url
            });
        }
        if (request.action == "preparePhoto") {
            ajax("https://api.vk.com/method/photos.get?owner_id=" + request.owner_id + "&album_id=saved&photo_ids=" + request.photo_id, function(data) {
                chrome['tabs'].sendMessage(sender.tab.id, {
                    action: "preparePhoto",
                    res: data,
                    link_id: request.link_id
                });
            });
        }
        if (request.action == "prepareFromScreenName") {
            var numId = request.screen_name.match(/^(?:videos)(\d+)$/);
            if (numId && numId[1]) {
                numId = numId[1];
            } else {
                numId = request.screen_name;
            }
            ajax("https://api.vk.com/method/users.get?user_ids=" + numId + "&fields=photo_id", function(data) {
                chrome['tabs'].sendMessage(sender.tab.id, {
                    action: "prepareFromScreenName",
                    isGroup: false,
                    screen_name: request.screen_name,
                    res: data,
                    link_id: request.link_id
                });
            });
        }
        if (request.action == "prepareFromGroupName") {
            var numId = request.screen_name.match(/^(?:public|club|event|market-|videos-|\?owner=-)(\d+)$/);
            if (numId && numId[1]) {
                numId = numId[1];
            } else {
                numId = request.screen_name;
            }
            ajax("https://api.vk.com/method/groups.getById?group_ids=" + numId, function(data) {
                chrome['tabs'].sendMessage(sender.tab.id, {
                    action: "prepareFromScreenName",
                    isGroup: true,
                    screen_name: numId,
                    res: data,
                    link_id: request.link_id
                });
            });
        }
    });
}

main();