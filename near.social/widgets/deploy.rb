#!/usr/bin/env ruby
require 'shellwords'


CONTRACT = "social.near"
ACCOUNT = "solleder.near"

# we want to deploy all the jsx files in this directory to the contract
Dir.glob("**/*.jsx") do |file|
  # sanitize file name
  name = file.gsub("./", "").gsub("/", "__").gsub(".jsx", "")

  puts "Deploying #{file} to #{CONTRACT} as #{name}"

  content = File.read(file)

  # escape quotes
  content = content.gsub('"', "\"")
  content = content.gsub("'", "\\'")

  # remove whitespace (at least two spaces)
  content = content.gsub("  ", "")

  # escape newlines
  content = content.gsub("\n", "\\n")


  # generate shell command  
  # NEAR_ENV=mainnet near call $CONTRACT set --accountId $ACCOUNT --args '{"data": {"$ACCOUNT": {"widget": {"$name": {"": $content}}}}}'
  # where $CONTRACT is the contract name, $ACCOUNT is the account name, $name is the file name, $content is the file content (escaped)
  args = "{\"data\": {\"#{ACCOUNT}\": {\"widget\": {\"#{name}\": {\"\": \"#{content}\"}}}}}"
  command = "NEAR_ENV=mainnet near call #{CONTRACT} --accountId #{ACCOUNT} set  --args '#{args}'"

  # puts command

  # execute shell command
  # system(command)
end
